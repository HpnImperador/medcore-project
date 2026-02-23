import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../common/auth/role.enum';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CleanupOutboxEventsDto } from './dto/cleanup-outbox-events.dto';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListOutboxReplayAuditDto } from './dto/list-outbox-replay-audit.dto';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';
import { OutboxAdminService } from './outbox-admin.service';

@ApiTags('Outbox')
@Controller('outbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class OutboxAdminController {
  constructor(private readonly outboxAdminService: OutboxAdminService) {}

  @Get('metrics')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Dashboard operacional do Outbox (métricas, thresholds e status por organização)',
  })
  @ApiOkResponse({
    description: 'Métricas operacionais do Outbox retornadas com sucesso.',
  })
  async metrics(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.outboxAdminService.getMetrics(currentUser);
  }

  @Get('events')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Lista eventos do Outbox para operação manual (filtros por status/evento/correlation_id)',
  })
  @ApiOkResponse({
    description: 'Eventos do Outbox retornados com sucesso.',
  })
  async listEvents(
    @Query() dto: ListOutboxEventsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.listEvents(dto, currentUser);
  }

  @Get('replay-audit')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Lista histórico recente de auditoria de replay manual do Outbox',
  })
  @ApiOkResponse({
    description: 'Auditoria de replay retornada com sucesso.',
  })
  async replayAudit(
    @Query() dto: ListOutboxReplayAuditDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.listReplayAudit(dto, currentUser);
  }

  @Get('maintenance-audit')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Lista histórico recente de auditoria da limpeza controlada do Outbox',
  })
  @ApiOkResponse({
    description: 'Auditoria de manutenção retornada com sucesso.',
  })
  async maintenanceAudit(
    @Query() dto: ListOutboxReplayAuditDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.listMaintenanceAudit(dto, currentUser);
  }

  @Post('replay-failed')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Reprocessa manualmente eventos FAILED do Outbox (somente ADMIN), com auditoria operacional',
  })
  @ApiOkResponse({
    description: 'Replay manual executado com sucesso.',
  })
  async replayFailed(
    @Body() dto: ReplayFailedEventsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.replayFailedEvents(dto, currentUser);
  }

  @Post('cleanup')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Executa limpeza controlada de eventos antigos do Outbox (dry-run por padrão, com trilha de auditoria)',
  })
  @ApiOkResponse({
    description: 'Limpeza controlada do Outbox executada com sucesso.',
  })
  async cleanup(
    @Body() dto: CleanupOutboxEventsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.cleanupEvents(dto, currentUser);
  }
}
