import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateOutboxEventInput,
  IOutboxRepository,
  OutboxEventEntity,
  OutboxMetrics,
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
}
