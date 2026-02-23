export type OutboxEventStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED';

export interface OutboxEventEntity {
  id: string;
  organization_id: string;
  event_name: string;
  payload: unknown;
  status: OutboxEventStatus;
  attempts: number;
  correlation_id: string;
  triggered_by_user_id: string | null;
  occurred_at: Date;
  processed_at: Date | null;
  last_error: string | null;
}

export interface CreateOutboxEventInput {
  organization_id: string;
  event_name: string;
  payload: unknown;
  correlation_id: string;
  triggered_by_user_id?: string | null;
}

export interface OutboxMetrics {
  pending_count: number;
  failed_count: number;
  processing_count: number;
  processed_count: number;
  oldest_pending_age_seconds: number;
  average_processing_latency_ms: number;
}

export interface ReplayFailedEventsInput {
  organization_id: string;
  requested_by_user_id: string;
  reason?: string;
  limit?: number;
  event_ids?: string[];
}

export interface ReplayFailedEventsResult {
  requested: number;
  replayed: number;
  skipped: number;
}

export interface IOutboxRepository {
  enqueue(input: CreateOutboxEventInput): Promise<void>;
  findProcessable(
    limit: number,
    maxAttempts: number,
  ): Promise<OutboxEventEntity[]>;
  claimForProcessing(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, errorMessage: string): Promise<void>;
  getMetrics(): Promise<OutboxMetrics>;
  replayFailedEvents(
    input: ReplayFailedEventsInput,
  ): Promise<ReplayFailedEventsResult>;
}
