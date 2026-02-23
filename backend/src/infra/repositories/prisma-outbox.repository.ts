import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CleanupOutboxEventsInput,
  CleanupOutboxEventsResult,
  CreateOutboxEventInput,
  IOutboxRepository,
  ListOutboxEventsInput,
  OutboxEventEntity,
  OutboxMaintenanceAuditEntry,
  OutboxMetrics,
  OutboxReplayAuditEntry,
  ReplayFailedEventsInput,
  ReplayFailedEventsResult,
} from '../../domain/repositories/outbox.repository.interface';

@Injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: CreateOutboxEventInput): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO domain_outbox_events (
        organization_id,
        event_name,
        payload,
        status,
        attempts,
        correlation_id,
        triggered_by_user_id
      )
      VALUES (
        ${input.organization_id}::uuid,
        ${input.event_name},
        ${JSON.stringify(input.payload)}::jsonb,
        'PENDING',
        0,
        ${input.correlation_id},
        ${input.triggered_by_user_id ?? null}::uuid
      )
    `;
  }

  findProcessable(
    limit: number,
    maxAttempts: number,
  ): Promise<OutboxEventEntity[]> {
    return this.prisma.$queryRaw<OutboxEventEntity[]>`
      SELECT
        id,
        organization_id,
        event_name,
        payload,
        status,
        attempts,
        correlation_id,
        triggered_by_user_id,
        occurred_at,
        processed_at,
        last_error
      FROM domain_outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND attempts < ${maxAttempts}
      ORDER BY occurred_at ASC
      LIMIT ${limit}
    `;
  }

  async claimForProcessing(eventId: string): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE domain_outbox_events
      SET
        status = 'PROCESSING',
        attempts = attempts + 1,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${eventId}::uuid
        AND status IN ('PENDING', 'FAILED')
    `;

    return Number(updated) > 0;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE domain_outbox_events
      SET
        status = 'PROCESSED',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        last_error = NULL
      WHERE id = ${eventId}::uuid
    `;
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE domain_outbox_events
      SET
        status = 'FAILED',
        last_error = LEFT(${errorMessage}, 2000),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${eventId}::uuid
    `;
  }

  async getMetrics(): Promise<OutboxMetrics> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        pending_count: number;
        failed_count: number;
        processing_count: number;
        processed_count: number;
        oldest_pending_age_seconds: number | null;
        average_processing_latency_ms: number | null;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_count,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
        COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing_count,
        COUNT(*) FILTER (WHERE status = 'PROCESSED')::int AS processed_count,
        COALESCE(
          MAX(
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - occurred_at))::int
          ) FILTER (WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')),
          0
        )::int AS oldest_pending_age_seconds,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (processed_at - occurred_at)) * 1000
          ) FILTER (WHERE status = 'PROCESSED' AND processed_at IS NOT NULL),
          0
        )::int AS average_processing_latency_ms
      FROM domain_outbox_events
    `;

    const row = rows[0];
    return {
      pending_count: row?.pending_count ?? 0,
      failed_count: row?.failed_count ?? 0,
      processing_count: row?.processing_count ?? 0,
      processed_count: row?.processed_count ?? 0,
      oldest_pending_age_seconds: row?.oldest_pending_age_seconds ?? 0,
      average_processing_latency_ms: row?.average_processing_latency_ms ?? 0,
    };
  }

  async listEvents(input: ListOutboxEventsInput): Promise<OutboxEventEntity[]> {
    const normalizedLimit =
      Number.isNaN(input.limit ?? 0) || (input.limit ?? 0) <= 0
        ? 50
        : Math.min(input.limit ?? 50, 200);

    const filters: Prisma.Sql[] = [
      Prisma.sql`organization_id = ${input.organization_id}::uuid`,
    ];

    if (input.status) {
      filters.push(Prisma.sql`status = ${input.status}`);
    }
    if (input.event_name) {
      filters.push(Prisma.sql`event_name = ${input.event_name}`);
    }
    if (input.correlation_id) {
      filters.push(Prisma.sql`correlation_id = ${input.correlation_id}`);
    }

    return this.prisma.$queryRaw<OutboxEventEntity[]>`
      SELECT
        id,
        organization_id,
        event_name,
        payload,
        status,
        attempts,
        correlation_id,
        triggered_by_user_id,
        occurred_at,
        processed_at,
        last_error
      FROM domain_outbox_events
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY occurred_at DESC
      LIMIT ${normalizedLimit}
    `;
  }

  listReplayAudit(
    organizationId: string,
    limit: number,
  ): Promise<OutboxReplayAuditEntry[]> {
    const normalizedLimit =
      Number.isNaN(limit) || limit <= 0 ? 20 : Math.min(limit, 200);

    return this.prisma.$queryRaw<OutboxReplayAuditEntry[]>`
      SELECT
        id,
        outbox_event_id,
        organization_id,
        requested_by_user_id,
        reason,
        mode,
        created_at
      FROM outbox_replay_audit
      WHERE organization_id = ${organizationId}::uuid
      ORDER BY created_at DESC
      LIMIT ${normalizedLimit}
    `;
  }

  listMaintenanceAudit(
    organizationId: string,
    limit: number,
  ): Promise<OutboxMaintenanceAuditEntry[]> {
    const normalizedLimit =
      Number.isNaN(limit) || limit <= 0 ? 20 : Math.min(limit, 200);

    return this.prisma.$queryRaw<OutboxMaintenanceAuditEntry[]>`
      SELECT
        id,
        organization_id,
        requested_by_user_id,
        action,
        criteria,
        affected_count,
        created_at
      FROM outbox_maintenance_audit
      WHERE organization_id = ${organizationId}::uuid
      ORDER BY created_at DESC
      LIMIT ${normalizedLimit}
    `;
  }

  async replayFailedEvents(
    input: ReplayFailedEventsInput,
  ): Promise<ReplayFailedEventsResult> {
    const normalizedLimit =
      Number.isNaN(input.limit ?? 0) || (input.limit ?? 0) <= 0
        ? 50
        : Math.min(input.limit ?? 50, 500);

    return this.prisma.$transaction(async (tx) => {
      const mode = input.event_ids?.length ? 'SELECTED' : 'BULK';
      const candidateRows = input.event_ids?.length
        ? await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM domain_outbox_events
            WHERE status = 'FAILED'
              AND id = ANY(${input.event_ids}::uuid[])
            ORDER BY occurred_at ASC
            LIMIT ${normalizedLimit}
          `
        : await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM domain_outbox_events
            WHERE status = 'FAILED'
            ORDER BY occurred_at ASC
            LIMIT ${normalizedLimit}
          `;

      if (candidateRows.length === 0) {
        await tx.$executeRaw`
          INSERT INTO outbox_replay_audit (
            outbox_event_id,
            organization_id,
            requested_by_user_id,
            reason,
            mode
          )
          VALUES (
            NULL,
            ${input.organization_id}::uuid,
            ${input.requested_by_user_id}::uuid,
            ${input.reason ?? 'manual_replay_without_failed_events'},
            ${mode}
          )
        `;
        return {
          requested: input.event_ids?.length ?? normalizedLimit,
          replayed: 0,
          skipped: input.event_ids?.length ?? 0,
        };
      }

      const ids = candidateRows.map((row) => row.id);
      const requested = input.event_ids?.length ?? ids.length;

      const updated = await tx.$executeRaw`
        UPDATE domain_outbox_events
        SET
          status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${ids}::uuid[])
          AND status = 'FAILED'
      `;

      await tx.$executeRaw`
        INSERT INTO outbox_replay_audit (
          outbox_event_id,
          organization_id,
          requested_by_user_id,
          reason,
          mode
        )
        SELECT
          e.id,
          e.organization_id,
          ${input.requested_by_user_id}::uuid,
          ${input.reason ?? null},
          ${mode}
        FROM domain_outbox_events e
        WHERE e.id = ANY(${ids}::uuid[])
      `;

      const replayed = Number(updated);
      return {
        requested,
        replayed,
        skipped: Math.max(0, requested - replayed),
      };
    });
  }

  async cleanupEvents(
    input: CleanupOutboxEventsInput,
  ): Promise<CleanupOutboxEventsResult> {
    const statuses = input.include_failed
      ? ['PROCESSED', 'FAILED']
      : ['PROCESSED'];
    const safeRetentionDays = Math.min(Math.max(input.retention_days, 1), 3650);

    const rows = await this.prisma.$queryRaw<Array<{ deleted_count: number }>>`
      SELECT COUNT(*)::int AS deleted_count
      FROM domain_outbox_events
      WHERE organization_id = ${input.organization_id}::uuid
        AND status = ANY(${statuses}::text[])
        AND COALESCE(processed_at, occurred_at) <
          (CURRENT_TIMESTAMP - (${safeRetentionDays} * INTERVAL '1 day'))
    `;
    const affectedCount = rows[0]?.deleted_count ?? 0;

    if (!input.dry_run && affectedCount > 0) {
      await this.prisma.$executeRaw`
        DELETE FROM domain_outbox_events
        WHERE organization_id = ${input.organization_id}::uuid
          AND status = ANY(${statuses}::text[])
          AND COALESCE(processed_at, occurred_at) <
            (CURRENT_TIMESTAMP - (${safeRetentionDays} * INTERVAL '1 day'))
      `;
    }

    await this.prisma.$executeRaw`
      INSERT INTO outbox_maintenance_audit (
        organization_id,
        requested_by_user_id,
        action,
        criteria,
        affected_count
      )
      VALUES (
        ${input.organization_id}::uuid,
        ${input.requested_by_user_id}::uuid,
        'CLEANUP',
        ${JSON.stringify({
          include_failed: input.include_failed,
          retention_days: safeRetentionDays,
          dry_run: input.dry_run,
        })}::jsonb,
        ${affectedCount}
      )
    `;

    return {
      deleted_count: affectedCount,
      dry_run: input.dry_run,
    };
  }
}
