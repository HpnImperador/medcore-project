import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
  const patient = await this.prisma.patients.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      document: data.document, // Novo
      birth_date: data.birth_date ? new Date(data.birth_date) : null, // Novo
      organization_id: data.organization_id,
    },
  });

  // Envia tudo para o n8n
  const N8N_URL = 'http://127.0.0.1:5678/webhook-test/1ebd30f0-29f4-48aa-8c50-5402475c6c08'; 
  try {
    await axios.post(N8N_URL, patient);
  } catch (e) {
    console.log('❌ Erro n8n');
  }

  return patient;
}

async findAll() {
  return this.prisma.patients.findMany({
    orderBy: {
      created_at: 'desc', // Os mais recentes aparecem primeiro
    },
  });
}

}