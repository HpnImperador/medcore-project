export interface HealthAlertEventEntity {
  id: string;
  event: string;
  status: string;
  webhook_url: string;
  reason: string;
  error: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateHealthAlertEventInput {
  event: 'health_alert_sent' | 'health_alert_failed';
  status: 'degraded' | 'error';
  webhook_url: string;
  reason: 'alert_sent' | 'alert_failed';
  error?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface IHealthAlertsRepository {
  create(input: CreateHealthAlertEventInput): Promise<HealthAlertEventEntity>;
  findRecent(limit: number): Promise<HealthAlertEventEntity[]>;
}
