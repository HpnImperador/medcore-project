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
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
}

export interface ReplayFailedEventsResult {
  requested: number;
  replayed: number;
  skipped: number;
}

export interface ListOutboxEventsInput {
  organization_id: string;
  status?: OutboxEventStatus;
  event_name?: string;
  correlation_id?: string;
  limit?: number;
}

export interface OutboxReplayAuditEntry {
  id: string;
  outbox_event_id: string | null;
  organization_id: string;
  requested_by_user_id: string;
  reason: string | null;
  mode: string;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  created_at: Date;
}

export interface CleanupOutboxEventsInput {
  organization_id: string;
  requested_by_user_id: string;
  retention_days: number;
  include_failed: boolean;
  dry_run: boolean;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
}

export interface CleanupOutboxEventsResult {
  deleted_count: number;
  dry_run: boolean;
}

export interface OutboxMaintenanceAuditEntry {
  id: string;
  organization_id: string;
  requested_by_user_id: string;
  action: string;
  criteria: unknown;
  affected_count: number;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  created_at: Date;
}

export interface ListOutboxAuditInput {
  organization_id: string;
  limit?: number;
  from?: Date;
  to?: Date;
}

export interface CleanupOutboxAuditsInput {
  organization_id: string;
  requested_by_user_id: string;
  retention_days: number;
  dry_run: boolean;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
}

export interface CleanupOutboxAuditsResult {
  replay_deleted_count: number;
  maintenance_deleted_count: number;
  total_deleted_count: number;
  dry_run: boolean;
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
  listEvents(input: ListOutboxEventsInput): Promise<OutboxEventEntity[]>;
  listReplayAudit(
    input: ListOutboxAuditInput,
  ): Promise<OutboxReplayAuditEntry[]>;
  listOrganizationsForMaintenance(): Promise<string[]>;
  listMaintenanceAudit(
    input: ListOutboxAuditInput,
  ): Promise<OutboxMaintenanceAuditEntry[]>;
  replayFailedEvents(
    input: ReplayFailedEventsInput,
  ): Promise<ReplayFailedEventsResult>;
  cleanupEvents(
    input: CleanupOutboxEventsInput,
  ): Promise<CleanupOutboxEventsResult>;
  cleanupAudits(
    input: CleanupOutboxAuditsInput,
  ): Promise<CleanupOutboxAuditsResult>;
}
