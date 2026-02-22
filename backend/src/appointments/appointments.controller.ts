import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';

@ApiTags('Appointments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo agendamento' })
  @ApiCreatedResponse({ description: 'Agendamento criado com sucesso.' })
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.create(createAppointmentDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Lista agendamentos do tenant autenticado' })
  @ApiOkResponse({
    description: 'Lista de agendamentos retornada com sucesso.',
  })
  async findAll(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.findAll(query, currentUser);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Conclui um agendamento e dispara webhook para o n8n',
  })
  @ApiParam({ name: 'id', example: 'e31ed3d4-280c-4d5e-aa00-5a686ec8bc9e' })
  @ApiOkResponse({ description: 'Agendamento concluído com sucesso.' })
  @ApiNotFoundResponse({
    description: 'Agendamento não encontrado no tenant/filiais.',
  })
  async complete(
    @Param('id') appointmentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.appointmentsService.complete(appointmentId, currentUser);
  }
}
