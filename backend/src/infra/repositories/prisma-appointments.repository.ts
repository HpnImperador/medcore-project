import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentEntity,
  AppointmentOutboxInput,
  CreateAppointmentRepositoryInput,
  DoctorEntity,
  DoctorScheduleEntity,
  FindAppointmentsFilters,
  IAppointmentsRepository,
  UpdateAppointmentRepositoryInput,
} from '../../domain/repositories/appointments.repository.interface';

interface AppointmentsDelegate {
  create(args: {
    data: {
      organization_id: string;
      branch_id: string;
      patient_id: string;
      doctor_id: string;
      scheduled_at: Date;
      status: string;
      notes?: string | null;
    };
  }): Promise<AppointmentEntity>;
  updateMany(args: {
    where: {
      id: string;
      organization_id: string;
      branch_id: { in: string[] };
    };
    data: { status: string };
  }): Promise<{ count: number }>;
  update(args: {
    where: {
      id: string;
    };
    data: {
      status?: string;
      scheduled_at?: Date;
      notes?: string | null;
    };
  }): Promise<AppointmentEntity>;
  findFirst(args: {
    where: {
      id?: string;
      organization_id: string;
      branch_id?: { in: string[] };
      doctor_id?: string;
      scheduled_at?: Date;
      status?: { not: string };
      NOT?: { id: string };
    };
  }): Promise<AppointmentEntity | null>;
  findMany(args: {
    where: {
      organization_id: string;
      branch_id: { in: string[] } | string;
      status?: string;
      scheduled_at?: {
        gte?: Date;
        lte?: Date;
      };
    };
    orderBy: { scheduled_at: 'asc' };
  }): Promise<AppointmentEntity[]>;
}

interface PrismaWithAppointments {
  appointments: AppointmentsDelegate;
}

interface PrismaSqlExecutor {
  $executeRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

@Injectable()
export class PrismaAppointmentsRepository implements IAppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateAppointmentRepositoryInput,
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity> {
    if (!outbox) {
      return this.appointmentsDelegate.create({
        data: {
          organization_id: input.organization_id,
          branch_id: input.branch_id,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id,
          scheduled_at: input.scheduled_at,
          status: input.status,
          notes: input.notes,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const delegate = this.getAppointmentsDelegate(tx);
      const appointment = await delegate.create({
        data: {
          organization_id: input.organization_id,
          branch_id: input.branch_id,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id,
          scheduled_at: input.scheduled_at,
          status: input.status,
          notes: input.notes,
        },
      });
      await this.insertOutboxEvent(tx, appointment, outbox);
      return appointment;
    });
  }

  async hasDoctorScheduleConflict(
    organizationId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const durationMs = Math.max(1, durationMinutes) * 60 * 1000;
    const lowerBoundExclusive = new Date(scheduledAt.getTime() - durationMs);
    const upperBoundExclusive = new Date(scheduledAt.getTime() + durationMs);

    const conflict = await this.prisma.appointments.findFirst({
      where: {
        organization_id: organizationId,
        doctor_id: doctorId,
        scheduled_at: {
          gt: lowerBoundExclusive,
          lt: upperBoundExclusive,
        },
        status: { not: 'CANCELED' },
        ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
      },
      select: { id: true },
    });

    return Boolean(conflict);
  }

  findDoctorAppointmentsInRange(
    organizationId: string,
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<AppointmentEntity[]> {
    return this.prisma.appointments.findMany({
      where: {
        organization_id: organizationId,
        doctor_id: doctorId,
        scheduled_at: {
          gte: from,
          lt: to,
        },
        status: {
          not: 'CANCELED',
        },
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });
  }

  findActiveDoctorScheduleByWeekday(
    organizationId: string,
    doctorId: string,
    weekday: number,
  ): Promise<DoctorScheduleEntity | null> {
    return this.prisma.$queryRaw<DoctorScheduleEntity[]>`
        SELECT
          id,
          organization_id,
          doctor_id,
          weekday,
          start_hour,
          end_hour,
          break_start_hour,
          break_end_hour,
          is_active
        FROM doctor_schedules
        WHERE organization_id = ${organizationId}::uuid
          AND doctor_id = ${doctorId}::uuid
          AND weekday = ${weekday}
          AND is_active = true
        ORDER BY updated_at DESC
        LIMIT 1
      `.then((rows) => rows[0] ?? null);
  }

  async completeByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity | null> {
    if (branchIds.length === 0) {
      return null;
    }

    if (!outbox) {
      const updated = await this.appointmentsDelegate.updateMany({
        where: {
          id: appointmentId,
          organization_id: organizationId,
          branch_id: { in: branchIds },
        },
        data: {
          status: 'COMPLETED',
        },
      });

      if (updated.count === 0) {
        return null;
      }

      return this.appointmentsDelegate.findFirst({
        where: {
          id: appointmentId,
          organization_id: organizationId,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const delegate = this.getAppointmentsDelegate(tx);
      const updated = await delegate.updateMany({
        where: {
          id: appointmentId,
          organization_id: organizationId,
          branch_id: { in: branchIds },
        },
        data: {
          status: 'COMPLETED',
        },
      });
      if (updated.count === 0) {
        return null;
      }

      const appointment = await delegate.findFirst({
        where: {
          id: appointmentId,
          organization_id: organizationId,
        },
      });
      if (!appointment) {
        return null;
      }

      await this.insertOutboxEvent(tx, appointment, outbox);
      return appointment;
    });
  }

  findByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
  ): Promise<AppointmentEntity | null> {
    if (branchIds.length === 0) {
      return Promise.resolve(null);
    }

    return this.appointmentsDelegate.findFirst({
      where: {
        id: appointmentId,
        organization_id: organizationId,
        branch_id: { in: branchIds },
      },
    });
  }

  async updateByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
    input: UpdateAppointmentRepositoryInput,
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity | null> {
    if (!outbox) {
      const existing = await this.findByIdInOrganizationAndBranches(
        appointmentId,
        organizationId,
        branchIds,
      );

      if (!existing) {
        return null;
      }

      return this.appointmentsDelegate.update({
        where: {
          id: appointmentId,
        },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const delegate = this.getAppointmentsDelegate(tx);
      const existing = await delegate.findFirst({
        where: {
          id: appointmentId,
          organization_id: organizationId,
          branch_id: { in: branchIds },
        },
      });
      if (!existing) {
        return null;
      }

      const updated = await delegate.update({
        where: {
          id: appointmentId,
        },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      await this.insertOutboxEvent(tx, updated, outbox);
      return updated;
    });
  }

  async findDoctorByIdAndOrganization(
    doctorId: string,
    organizationId: string,
  ): Promise<DoctorEntity | null> {
    return this.prisma.users.findFirst({
      where: {
        id: doctorId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        organization_id: true,
        role: true,
      },
    });
  }

  async isDoctorInBranch(doctorId: string, branchId: string): Promise<boolean> {
    const binding = await this.prisma.user_branches.findUnique({
      where: {
        user_id_branch_id: {
          user_id: doctorId,
          branch_id: branchId,
        },
      },
      select: { user_id: true },
    });

    return Boolean(binding);
  }

  async isBranchFromOrganization(
    branchId: string,
    organizationId: string,
  ): Promise<boolean> {
    const branch = await this.prisma.branches.findFirst({
      where: {
        id: branchId,
        organization_id: organizationId,
      },
      select: { id: true },
    });

    return Boolean(branch);
  }

  findAllByOrganizationAndBranches(
    organizationId: string,
    branchIds: string[],
    filters?: FindAppointmentsFilters,
  ): Promise<AppointmentEntity[]> {
    return this.appointmentsDelegate.findMany({
      where: {
        organization_id: organizationId,
        branch_id: {
          in: branchIds,
        },
        ...(filters?.branchId ? { branch_id: filters.branchId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.from || filters?.to
          ? {
              scheduled_at: {
                ...(filters?.from ? { gte: filters.from } : {}),
                ...(filters?.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });
  }

  private get appointmentsDelegate() {
    return (this.prisma as unknown as PrismaWithAppointments).appointments;
  }

  private getAppointmentsDelegate(client: unknown): AppointmentsDelegate {
    return (client as PrismaWithAppointments).appointments;
  }

  private async insertOutboxEvent(
    executor: unknown,
    appointment: AppointmentEntity,
    outbox: AppointmentOutboxInput,
  ): Promise<void> {
    const payload = {
      event: outbox.event_name,
      timestamp: new Date().toISOString(),
      organization_id: appointment.organization_id,
      branch_id: appointment.branch_id,
      appointment,
    };

    await (executor as PrismaSqlExecutor).$executeRaw`
      INSERT INTO domain_outbox_events (
        organization_id,
        event_name,
        payload,
        status,
        attempts,
        correlation_id,
        triggered_by_user_id
      )
      VALUES (
        ${appointment.organization_id}::uuid,
        ${outbox.event_name},
        ${JSON.stringify(payload)}::jsonb,
        'PENDING',
        0,
        ${outbox.correlation_id},
        ${outbox.triggered_by_user_id ?? null}::uuid
      )
    `;
  }
}
