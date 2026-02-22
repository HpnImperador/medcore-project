import { Controller, Get, Post, Body } from '@nestjs/common';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // ROTA PARA CADASTRAR: Recebe os dados do formulário do Dashboard
  @Post()
  async create(@Body() createPatientDto: any) {
    return this.patientsService.create(createPatientDto);
  }

  // ROTA PARA LISTAR: Alimenta a tabela do seu Dashboard
  @Get()
async findAll() {
  return this.patientsService.findAll();
}
}