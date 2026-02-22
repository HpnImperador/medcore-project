import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@ApiTags('Patients')
@ApiBearerAuth('JWT-auth')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @ApiOperation({ summary: 'Cria um novo paciente' })
  @ApiCreatedResponse({ description: 'Paciente criado com sucesso.' })
  @Post()
  async create(@Body() createPatientDto: CreatePatientDto) {
    return this.patientsService.create(createPatientDto);
  }

  @ApiOperation({ summary: 'Lista pacientes por organização' })
  @ApiQuery({
    name: 'organization_id',
    required: true,
    example: 'f8f79fe1-c4cf-4d98-b6e5-e5dd574029f4',
  })
  @ApiOkResponse({ description: 'Lista de pacientes retornada com sucesso.' })
  @Get()
  async findAll(@Query('organization_id') organizationId?: string) {
    if (!organizationId) {
      throw new BadRequestException(
        'organization_id é obrigatório para listar pacientes.',
      );
    }
    return this.patientsService.findAll(organizationId);
  }
}
