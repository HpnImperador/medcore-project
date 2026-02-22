export interface PatientEntity {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  birth_date: Date | null;
  created_at: Date;
}

export interface CreatePatientRepositoryInput {
  organization_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  birth_date?: Date | null;
}

export interface IPatientsRepository {
  create(input: CreatePatientRepositoryInput): Promise<PatientEntity>;
  findAllByOrganization(organizationId: string): Promise<PatientEntity[]>;
  findByIdAndOrganization(
    patientId: string,
    organizationId: string,
  ): Promise<PatientEntity | null>;
}
