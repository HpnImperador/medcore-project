export interface AppointmentEntity {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: Date;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DoctorEntity {
  id: string;
  organization_id: string | null;
  role: string | null;
}

export interface DoctorScheduleEntity {
  id: string;
  organization_id: string;
  doctor_id: string;
  weekday: number;
  start_hour: number;
  end_hour: number;
  break_start_hour: number | null;
  break_end_hour: number | null;
  is_active: boolean;
}

export interface CreateAppointmentRepositoryInput {
  organization_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: Date;
  status: string;
  notes?: string | null;
}

export interface FindAppointmentsFilters {
  branchId?: string;
  from?: Date;
  to?: Date;
  status?: string;
}

export interface UpdateAppointmentRepositoryInput {
  status?: string;
  scheduled_at?: Date;
  notes?: string | null;
}

export interface AppointmentOutboxInput {
  event_name:
    | 'appointment.created'
    | 'appointment.completed'
    | 'appointment.canceled'
    | 'appointment.rescheduled';
  correlation_id: string;
  triggered_by_user_id?: string | null;
}

export interface IAppointmentsRepository {
  create(
    input: CreateAppointmentRepositoryInput,
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity>;
  hasDoctorScheduleConflict(
    organizationId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<boolean>;
  findDoctorAppointmentsInRange(
    organizationId: string,
    doctorId: string,
    from: Date,
    to: Date,
  ): Promise<AppointmentEntity[]>;
  findActiveDoctorScheduleByWeekday(
    organizationId: string,
    doctorId: string,
    weekday: number,
  ): Promise<DoctorScheduleEntity | null>;
  findByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
  ): Promise<AppointmentEntity | null>;
  updateByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
    input: UpdateAppointmentRepositoryInput,
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity | null>;
  completeByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
    outbox?: AppointmentOutboxInput,
  ): Promise<AppointmentEntity | null>;
  findDoctorByIdAndOrganization(
    doctorId: string,
    organizationId: string,
  ): Promise<DoctorEntity | null>;
  isDoctorInBranch(doctorId: string, branchId: string): Promise<boolean>;
  isBranchFromOrganization(
    branchId: string,
    organizationId: string,
  ): Promise<boolean>;
  findAllByOrganizationAndBranches(
    organizationId: string,
    branchIds: string[],
    filters?: FindAppointmentsFilters,
  ): Promise<AppointmentEntity[]>;
}
