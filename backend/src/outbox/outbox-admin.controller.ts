import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '../common/auth/role.enum';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CleanupOutboxAuditsDto } from './dto/cleanup-outbox-audits.dto';
import { CleanupOutboxEventsDto } from './dto/cleanup-outbox-events.dto';
import { ExportOutboxAuditDto } from './dto/export-outbox-audit.dto';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListOutboxReplayAuditDto } from './dto/list-outbox-replay-audit.dto';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';
import { OutboxAdminRateLimitGuard } from './outbox-admin-rate-limit.guard';
import { OutboxAdminService } from './outbox-admin.service';

@ApiTags('Outbox')
@Controller('outbox')
@UseGuards(JwtAuthGuard, RolesGuard, OutboxAdminRateLimitGuard)
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

  @Get('audit/export')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Exporta auditoria do Outbox (replay ou manutenção) em formato JSON/CSV com filtro temporal',
  })
  @ApiOkResponse({
    description: 'Exportação de auditoria executada com sucesso.',
  })
  async exportAudit(
    @Query() dto: ExportOutboxAuditDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.exportAudit(dto, currentUser);
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
    @Req() request: Request,
  ) {
    return this.outboxAdminService.replayFailedEvents(
      dto,
      currentUser,
      this.extractAuditContext(request),
    );
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
    @Req() request: Request,
  ) {
    return this.outboxAdminService.cleanupEvents(
      dto,
      currentUser,
      this.extractAuditContext(request),
    );
  }

  @Post('audit/cleanup')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Executa limpeza de retenção das tabelas de auditoria do Outbox (dry-run por padrão)',
  })
  @ApiOkResponse({
    description: 'Limpeza de auditorias do Outbox executada com sucesso.',
  })
  async cleanupAudits(
    @Body() dto: CleanupOutboxAuditsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.outboxAdminService.cleanupAudits(
      dto,
      currentUser,
      this.extractAuditContext(request),
    );
  }

  private extractAuditContext(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : request.ip || request.socket.remoteAddress || undefined;
    const userAgentHeader = request.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string'
        ? userAgentHeader.slice(0, 500)
        : undefined;
    const correlationHeader =
      request.headers['x-correlation-id'] ?? request.headers['x-request-id'];
    const correlationId =
      typeof correlationHeader === 'string'
        ? correlationHeader.slice(0, 120)
        : `outbox-${Date.now()}`;

    return {
      ip_address: ipAddress,
      user_agent: userAgent,
      correlation_id: correlationId,
    };
  }
}
