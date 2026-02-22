import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePatientRepositoryInput,
  IPatientsRepository,
  PatientEntity,
} from '../../domain/repositories/patients.repository.interface';

@Injectable()
export class PrismaPatientsRepository implements IPatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePatientRepositoryInput): Promise<PatientEntity> {
    return this.prisma.patients.create({
      data: {
        organization_id: input.organization_id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        document: input.document,
        birth_date: input.birth_date,
      },
    });
  }

  async findAllByOrganization(
    organizationId: string,
  ): Promise<PatientEntity[]> {
    return this.prisma.patients.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByIdAndOrganization(
    patientId: string,
    organizationId: string,
  ): Promise<PatientEntity | null> {
    return this.prisma.patients.findFirst({
      where: {
        id: patientId,
        organization_id: organizationId,
      },
    });
  }
}
