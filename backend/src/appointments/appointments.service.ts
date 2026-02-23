import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppointmentEntity,
  IAppointmentsRepository,
} from '../domain/repositories/appointments.repository.interface';
import type { IPatientsRepository } from '../domain/repositories/patients.repository.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { GetAvailableSlotsQueryDto } from './dto/get-available-slots-query.dto';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.APPOINTMENTS)
    private readonly appointmentsRepository: IAppointmentsRepository,
    @Inject(REPOSITORY_TOKENS.PATIENTS)
    private readonly patientsRepository: IPatientsRepository,
    private readonly n8nWebhookService: N8nWebhookService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity> {
    this.ensureFutureDate(dto.scheduled_at);

    if (!currentUser.branchIds.includes(dto.branch_id)) {
      throw new ForbiddenException(
        'Usuário não possui acesso à filial informada para criar o agendamento.',
      );
    }

    const [patient, doctor, isBranchFromOrg, isDoctorInBranch] =
      await Promise.all([
        this.patientsRepository.findByIdAndOrganization(
          dto.patient_id,
          currentUser.organizationId,
        ),
        this.appointmentsRepository.findDoctorByIdAndOrganization(
          dto.doctor_id,
          currentUser.organizationId,
        ),
        this.appointmentsRepository.isBranchFromOrganization(
          dto.branch_id,
          currentUser.organizationId,
        ),
        this.appointmentsRepository.isDoctorInBranch(
          dto.doctor_id,
          dto.branch_id,
        ),
      ]);

    if (!patient) {
      throw new NotFoundException(
        'Paciente não encontrado na organização do usuário autenticado.',
      );
    }

    if (!doctor) {
      throw new NotFoundException(
        'Médico não encontrado na organização do usuário autenticado.',
      );
    }

    if (!isBranchFromOrg) {
      throw new ForbiddenException(
        'A filial não pertence à organização do usuário.',
      );
    }

    if (!isDoctorInBranch) {
      throw new BadRequestException(
        'Médico não possui vínculo com a filial informada em user_branches.',
      );
    }

    await this.ensureDoctorAvailability(
      currentUser.organizationId,
      dto.doctor_id,
      dto.scheduled_at,
    );

    const appointment = await this.appointmentsRepository.create({
      organization_id: currentUser.organizationId,
      branch_id: dto.branch_id,
      patient_id: dto.patient_id,
      doctor_id: dto.doctor_id,
      scheduled_at: dto.scheduled_at,
      status: 'SCHEDULED',
      notes: dto.notes,
    });

    return appointment;
  }

  async complete(
    appointmentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity> {
    const appointment =
      await this.appointmentsRepository.completeByIdInOrganizationAndBranches(
        appointmentId,
        currentUser.organizationId,
        currentUser.branchIds,
      );

    if (!appointment) {
      throw new NotFoundException(
        'Agendamento não encontrado para a organização/filiais permitidas.',
      );
    }

    void this.n8nWebhookService.notifyAppointmentCompleted({
      event: 'appointment.completed',
      timestamp: new Date().toISOString(),
      organization_id: appointment.organization_id,
      branch_id: appointment.branch_id,
      appointment,
    });

    return appointment;
  }

  async cancel(
    appointmentId: string,
    dto: CancelAppointmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity> {
    const existing = await this.findAccessibleAppointment(
      appointmentId,
      currentUser,
    );

    this.ensureCanMutateAppointment(existing.status, 'cancelar');

    const currentNotes = existing.notes?.trim() ?? '';
    const cancelAudit = `[CANCELADO] ${dto.reason.trim()}`;
    const mergedNotes = currentNotes
      ? `${currentNotes}\n${cancelAudit}`
      : cancelAudit;

    const updated =
      await this.appointmentsRepository.updateByIdInOrganizationAndBranches(
        appointmentId,
        currentUser.organizationId,
        currentUser.branchIds,
        {
          status: 'CANCELED',
          notes: mergedNotes,
        },
      );

    if (!updated) {
      throw new NotFoundException(
        'Agendamento não encontrado para a organização/filiais permitidas.',
      );
    }

    return updated;
  }

  async reschedule(
    appointmentId: string,
    dto: RescheduleAppointmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity> {
    this.ensureFutureDate(dto.scheduled_at);
    const existing = await this.findAccessibleAppointment(
      appointmentId,
      currentUser,
    );

    this.ensureCanMutateAppointment(existing.status, 'reagendar');
    await this.ensureDoctorAvailability(
      currentUser.organizationId,
      existing.doctor_id,
      dto.scheduled_at,
      appointmentId,
    );

    const reason = dto.reason?.trim();
    const currentNotes = existing.notes?.trim() ?? '';
    const rescheduleAudit = reason
      ? `[REAGENDADO] ${reason}`
      : '[REAGENDADO] Alteração de data/hora sem motivo informado.';
    const mergedNotes = currentNotes
      ? `${currentNotes}\n${rescheduleAudit}`
      : rescheduleAudit;

    const updated =
      await this.appointmentsRepository.updateByIdInOrganizationAndBranches(
        appointmentId,
        currentUser.organizationId,
        currentUser.branchIds,
        {
          status: 'SCHEDULED',
          scheduled_at: dto.scheduled_at,
          notes: mergedNotes,
        },
      );

    if (!updated) {
      throw new NotFoundException(
        'Agendamento não encontrado para a organização/filiais permitidas.',
      );
    }

    return updated;
  }

  async findAll(
    query: ListAppointmentsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity[]> {
    if (query.branch_id && !currentUser.branchIds.includes(query.branch_id)) {
      throw new ForbiddenException(
        'Usuário não possui acesso à filial informada.',
      );
    }

    const allowedBranches = query.branch_id
      ? [query.branch_id]
      : currentUser.branchIds;

    if (allowedBranches.length === 0) {
      return [];
    }

    return this.appointmentsRepository.findAllByOrganizationAndBranches(
      currentUser.organizationId,
      allowedBranches,
      {
        branchId: query.branch_id,
        from: query.from,
        to: query.to,
        status: query.status,
      },
    );
  }

  async getAvailableSlots(
    query: GetAvailableSlotsQueryDto,
    currentUser: AuthenticatedUser,
  ): Promise<{ slots: string[] }> {
    if (!currentUser.branchIds.includes(query.branch_id)) {
      throw new ForbiddenException(
        'Usuário não possui acesso à filial informada.',
      );
    }

    const [doctor, isBranchFromOrg, isDoctorInBranch] = await Promise.all([
      this.appointmentsRepository.findDoctorByIdAndOrganization(
        query.doctor_id,
        currentUser.organizationId,
      ),
      this.appointmentsRepository.isBranchFromOrganization(
        query.branch_id,
        currentUser.organizationId,
      ),
      this.appointmentsRepository.isDoctorInBranch(
        query.doctor_id,
        query.branch_id,
      ),
    ]);

    if (!doctor) {
      throw new NotFoundException(
        'Médico não encontrado na organização do usuário autenticado.',
      );
    }

    if (!isBranchFromOrg) {
      throw new ForbiddenException(
        'A filial não pertence à organização do usuário.',
      );
    }

    if (!isDoctorInBranch) {
      throw new BadRequestException(
        'Médico não possui vínculo com a filial informada em user_branches.',
      );
    }

    const durationMinutes = this.getAppointmentDurationMinutes();
    const slotIntervalMinutes = this.getSlotIntervalMinutes(durationMinutes);
    const dayStart = this.getDayBoundary(
      query.date,
      this.getWorkdayStartHour(),
    );
    const dayEnd = this.getDayBoundary(query.date, this.getWorkdayEndHour());

    if (dayEnd.getTime() <= dayStart.getTime()) {
      throw new BadRequestException(
        'Configuração inválida: horário final da agenda deve ser maior que o inicial.',
      );
    }

    const appointments =
      await this.appointmentsRepository.findDoctorAppointmentsInRange(
        currentUser.organizationId,
        query.doctor_id,
        dayStart,
        dayEnd,
      );

    const durationMs = durationMinutes * 60 * 1000;
    const intervalMs = slotIntervalMinutes * 60 * 1000;
    const lastSlotStart = dayEnd.getTime() - durationMs;
    const slots: string[] = [];

    for (
      let slotStartMs = dayStart.getTime();
      slotStartMs <= lastSlotStart;
      slotStartMs += intervalMs
    ) {
      const slotEndMs = slotStartMs + durationMs;
      const overlaps = appointments.some((appointment) => {
        const appointmentStartMs = appointment.scheduled_at.getTime();
        const appointmentEndMs = appointmentStartMs + durationMs;
        return slotStartMs < appointmentEndMs && appointmentStartMs < slotEndMs;
      });

      if (!overlaps) {
        slots.push(new Date(slotStartMs).toISOString());
      }
    }

    return { slots };
  }

  private ensureFutureDate(scheduledAt: Date): void {
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('A data do agendamento deve ser futura.');
    }
  }

  private async findAccessibleAppointment(
    appointmentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<AppointmentEntity> {
    const appointment =
      await this.appointmentsRepository.findByIdInOrganizationAndBranches(
        appointmentId,
        currentUser.organizationId,
        currentUser.branchIds,
      );

    if (!appointment) {
      throw new NotFoundException(
        'Agendamento não encontrado para a organização/filiais permitidas.',
      );
    }

    return appointment;
  }

  private ensureCanMutateAppointment(
    status: string,
    actionLabel: 'cancelar' | 'reagendar',
  ): void {
    const normalizedStatus = status.toUpperCase();

    if (normalizedStatus === 'COMPLETED') {
      throw new BadRequestException(
        `Não é possível ${actionLabel} um agendamento concluído.`,
      );
    }

    if (normalizedStatus === 'CANCELED') {
      throw new BadRequestException(
        `Não é possível ${actionLabel} um agendamento já cancelado.`,
      );
    }
  }

  private async ensureDoctorAvailability(
    organizationId: string,
    doctorId: string,
    scheduledAt: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const durationMinutes = this.getAppointmentDurationMinutes();
    const hasConflict =
      await this.appointmentsRepository.hasDoctorScheduleConflict(
        organizationId,
        doctorId,
        scheduledAt,
        durationMinutes,
        excludeAppointmentId,
      );

    if (hasConflict) {
      throw new BadRequestException(
        'Conflito de agenda: médico já possui consulta neste horário.',
      );
    }
  }

  private getAppointmentDurationMinutes(): number {
    const configured = this.configService.get<string>(
      'APPOINTMENT_DURATION_MINUTES',
    );
    const parsed = Number.parseInt(configured ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 30;
    }
    return parsed;
  }

  private getSlotIntervalMinutes(durationMinutes: number): number {
    const configured = this.configService.get<string>(
      'APPOINTMENT_SLOT_INTERVAL_MINUTES',
    );
    const parsed = Number.parseInt(configured ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return durationMinutes;
    }
    return parsed;
  }

  private getWorkdayStartHour(): number {
    return this.getHourConfig('APPOINTMENT_WORKDAY_START_HOUR', 8);
  }

  private getWorkdayEndHour(): number {
    return this.getHourConfig('APPOINTMENT_WORKDAY_END_HOUR', 18);
  }

  private getHourConfig(envName: string, defaultValue: number): number {
    const configured = this.configService.get<string>(envName);
    const parsed = Number.parseInt(configured ?? '', 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) {
      return defaultValue;
    }
    return parsed;
  }

  private getDayBoundary(baseDate: Date, hourUtc: number): Date {
    return new Date(
      Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate(),
        hourUtc,
        0,
        0,
        0,
      ),
    );
  }
}
