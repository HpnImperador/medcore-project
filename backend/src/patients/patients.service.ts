import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IPatientsRepository } from '../domain/repositories/patients.repository.interface';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.PATIENTS)
    private readonly patientsRepository: IPatientsRepository,
  ) {}

  async create(data: CreatePatientDto) {
    const patient = await this.patientsRepository.create({
      organization_id: data.organization_id,
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      document: data.document ?? null,
      birth_date: data.birth_date ?? null,
    });

    // Envia tudo para o n8n
    const N8N_URL =
      'http://127.0.0.1:5678/webhook-test/1ebd30f0-29f4-48aa-8c50-5402475c6c08';
    try {
      await axios.post(N8N_URL, patient);
    } catch {
      console.log('❌ Erro n8n');
    }

    return patient;
  }

  async findAll(organizationId: string) {
    return this.patientsRepository.findAllByOrganization(organizationId);
  }
}
