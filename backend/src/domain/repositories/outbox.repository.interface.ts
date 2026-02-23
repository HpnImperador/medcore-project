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

export interface IOutboxRepository {
  enqueue(input: CreateOutboxEventInput): Promise<void>;
  findProcessable(
    limit: number,
    maxAttempts: number,
  ): Promise<OutboxEventEntity[]>;
  claimForProcessing(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, errorMessage: string): Promise<void>;
}
