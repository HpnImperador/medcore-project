import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type {
  IOutboxRepository,
  OutboxMaintenanceAuditEntry,
  OutboxReplayAuditEntry,
} from '../domain/repositories/outbox.repository.interface';
import { CleanupOutboxAuditsDto } from './dto/cleanup-outbox-audits.dto';
import { CleanupOutboxEventsDto } from './dto/cleanup-outbox-events.dto';
import { ExportOutboxAuditDto } from './dto/export-outbox-audit.dto';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListOutboxReplayAuditDto } from './dto/list-outbox-replay-audit.dto';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';

export interface OutboxAuditRequestContext {
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
}

@Injectable()
export class OutboxAdminService {
  constructor(
    @Inject(REPOSITORY_TOKENS.OUTBOX)
    private readonly outboxRepository: IOutboxRepository,
    private readonly configService: ConfigService,
  ) {}

  async getMetrics(currentUser: AuthenticatedUser) {
    const metrics = await this.outboxRepository.getMetrics();
    const thresholds = {
      pending_limit: this.getPositiveIntEnv(
        'OUTBOX_ALERT_PENDING_THRESHOLD',
        50,
      ),
      failed_limit: this.getPositiveIntEnv('OUTBOX_ALERT_FAILED_THRESHOLD', 10),
      oldest_pending_seconds_limit: this.getPositiveIntEnv(
        'OUTBOX_ALERT_OLDEST_PENDING_SECONDS',
        300,
      ),
    };

    return {
      organization_id: currentUser.organizationId,
      status: this.computeOutboxStatus(metrics, thresholds),
      metrics,
      thresholds,
      timestamp: new Date().toISOString(),
    };
  }

  async listEvents(dto: ListOutboxEventsDto, currentUser: AuthenticatedUser) {
    return this.outboxRepository.listEvents({
      organization_id: currentUser.organizationId,
      status: dto.status,
      event_name: dto.event_name,
      correlation_id: dto.correlation_id,
      limit: dto.limit,
    });
  }

  async listReplayAudit(
    dto: ListOutboxReplayAuditDto,
    currentUser: AuthenticatedUser,
  ) {
    const limit = dto.limit ?? 20;
    return this.outboxRepository.listReplayAudit({
      organization_id: currentUser.organizationId,
      limit,
    });
  }

  async listMaintenanceAudit(
    dto: ListOutboxReplayAuditDto,
    currentUser: AuthenticatedUser,
  ) {
    const limit = dto.limit ?? 20;
    return this.outboxRepository.listMaintenanceAudit({
      organization_id: currentUser.organizationId,
      limit,
    });
  }

  async exportAudit(
    dto: ExportOutboxAuditDto,
    currentUser: AuthenticatedUser,
  ): Promise<{
    type: 'replay' | 'maintenance';
    format: 'json' | 'csv';
    total: number;
    generated_at: string;
    payload: unknown;
  }> {
    const format = dto.format ?? 'json';
    const type = dto.type ?? 'maintenance';
    const limit = dto.limit ?? 1000;
    const from = this.parseDateOrUndefined(dto.from, 'from');
    const to = this.parseDateOrUndefined(dto.to, 'to');

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'Parâmetro from não pode ser maior que to.',
      );
    }

    const rows =
      type === 'replay'
        ? await this.outboxRepository.listReplayAudit({
            organization_id: currentUser.organizationId,
            limit,
            from,
            to,
          })
        : await this.outboxRepository.listMaintenanceAudit({
            organization_id: currentUser.organizationId,
            limit,
            from,
            to,
          });

    const payload = format === 'csv' ? this.toCsv(type, rows) : rows;

    return {
      type,
      format,
      total: rows.length,
      generated_at: new Date().toISOString(),
      payload,
    };
  }

  async replayFailedEvents(
    dto: ReplayFailedEventsDto,
    currentUser: AuthenticatedUser,
    context: OutboxAuditRequestContext,
  ) {
    const result = await this.outboxRepository.replayFailedEvents({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      reason: dto.reason,
      limit: dto.limit,
      event_ids: dto.event_ids,
      ...context,
    });

    return {
      mode: dto.event_ids?.length ? 'SELECTED' : 'BULK',
      ...result,
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      correlation_id: context.correlation_id,
      timestamp: new Date().toISOString(),
    };
  }

  async cleanupEvents(
    dto: CleanupOutboxEventsDto,
    currentUser: AuthenticatedUser,
    context: OutboxAuditRequestContext,
  ) {
    const result = await this.outboxRepository.cleanupEvents({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: dto.retention_days ?? 30,
      include_failed: dto.include_failed ?? false,
      dry_run: dto.dry_run ?? true,
      ...context,
    });

    return {
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: dto.retention_days ?? 30,
      include_failed: dto.include_failed ?? false,
      ...result,
      correlation_id: context.correlation_id,
      timestamp: new Date().toISOString(),
    };
  }

  async cleanupAudits(
    dto: CleanupOutboxAuditsDto,
    currentUser: AuthenticatedUser,
    context: OutboxAuditRequestContext,
  ) {
    const retentionDays = dto.retention_days ?? 90;
    const result = await this.outboxRepository.cleanupAudits({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: retentionDays,
      dry_run: dto.dry_run ?? true,
      ...context,
    });

    return {
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: retentionDays,
      ...result,
      correlation_id: context.correlation_id,
      timestamp: new Date().toISOString(),
    };
  }

  private computeOutboxStatus(
    metrics: {
      pending_count: number;
      failed_count: number;
      oldest_pending_age_seconds: number;
    },
    thresholds: {
      pending_limit: number;
      failed_limit: number;
      oldest_pending_seconds_limit: number;
    },
  ): 'up' | 'degraded' | 'error' {
    if (
      metrics.pending_count >= thresholds.pending_limit * 2 ||
      metrics.failed_count >= thresholds.failed_limit * 2
    ) {
      return 'error';
    }

    if (
      metrics.pending_count >= thresholds.pending_limit ||
      metrics.failed_count >= thresholds.failed_limit ||
      metrics.oldest_pending_age_seconds >=
        thresholds.oldest_pending_seconds_limit
    ) {
      return 'degraded';
    }

    return 'up';
  }

  private getPositiveIntEnv(envName: string, fallback: number): number {
    const raw = this.configService.get<string>(envName);
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private parseDateOrUndefined(
    input: string | undefined,
    fieldName: string,
  ): Date | undefined {
    if (!input) {
      return undefined;
    }

    const value = new Date(input);
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(
        `${fieldName} deve estar em formato ISO 8601 válido.`,
      );
    }

    return value;
  }

  private toCsv(
    type: 'replay' | 'maintenance',
    rows: OutboxReplayAuditEntry[] | OutboxMaintenanceAuditEntry[],
  ): string {
    if (type === 'replay') {
      const replayRows = rows as OutboxReplayAuditEntry[];
      const header = [
        'id',
        'outbox_event_id',
        'organization_id',
        'requested_by_user_id',
        'reason',
        'mode',
        'ip_address',
        'user_agent',
        'correlation_id',
        'created_at',
      ];
      const data = replayRows.map((row) => [
        row.id,
        row.outbox_event_id,
        row.organization_id,
        row.requested_by_user_id,
        row.reason,
        row.mode,
        row.ip_address,
        row.user_agent,
        row.correlation_id,
        row.created_at.toISOString(),
      ]);
      return this.buildCsv([header, ...data]);
    }

    const maintenanceRows = rows as OutboxMaintenanceAuditEntry[];
    const header = [
      'id',
      'organization_id',
      'requested_by_user_id',
      'action',
      'criteria',
      'affected_count',
      'ip_address',
      'user_agent',
      'correlation_id',
      'created_at',
    ];
    const data = maintenanceRows.map((row) => [
      row.id,
      row.organization_id,
      row.requested_by_user_id,
      row.action,
      JSON.stringify(row.criteria),
      String(row.affected_count),
      row.ip_address,
      row.user_agent,
      row.correlation_id,
      row.created_at.toISOString(),
    ]);
    return this.buildCsv([header, ...data]);
  }

  private buildCsv(lines: Array<Array<string | null | undefined>>): string {
    return lines
      .map((columns) =>
        columns.map((value) => this.escapeCsvValue(value ?? '')).join(','),
      )
      .join('\n');
  }

  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
