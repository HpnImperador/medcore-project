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

export interface IAppointmentsRepository {
  create(input: CreateAppointmentRepositoryInput): Promise<AppointmentEntity>;
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
  ): Promise<AppointmentEntity | null>;
  completeByIdInOrganizationAndBranches(
    appointmentId: string,
    organizationId: string,
    branchIds: string[],
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
