import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';
import { CleanupOutboxEventsDto } from './dto/cleanup-outbox-events.dto';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListOutboxReplayAuditDto } from './dto/list-outbox-replay-audit.dto';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';

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
    return this.outboxRepository.listReplayAudit(
      currentUser.organizationId,
      limit,
    );
  }

  async listMaintenanceAudit(
    dto: ListOutboxReplayAuditDto,
    currentUser: AuthenticatedUser,
  ) {
    const limit = dto.limit ?? 20;
    return this.outboxRepository.listMaintenanceAudit(
      currentUser.organizationId,
      limit,
    );
  }

  async replayFailedEvents(
    dto: ReplayFailedEventsDto,
    currentUser: AuthenticatedUser,
  ) {
    const result = await this.outboxRepository.replayFailedEvents({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      reason: dto.reason,
      limit: dto.limit,
      event_ids: dto.event_ids,
    });

    return {
      mode: dto.event_ids?.length ? 'SELECTED' : 'BULK',
      ...result,
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      timestamp: new Date().toISOString(),
    };
  }

  async cleanupEvents(
    dto: CleanupOutboxEventsDto,
    currentUser: AuthenticatedUser,
  ) {
    const result = await this.outboxRepository.cleanupEvents({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: dto.retention_days ?? 30,
      include_failed: dto.include_failed ?? false,
      dry_run: dto.dry_run ?? true,
    });

    return {
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      retention_days: dto.retention_days ?? 30,
      include_failed: dto.include_failed ?? false,
      ...result,
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
}
