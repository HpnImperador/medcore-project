import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type {
  HealthAlertEventEntity,
  IHealthAlertsRepository,
} from '../domain/repositories/health-alerts.repository.interface';

interface HealthSummaryLike {
  status: 'ok' | 'degraded' | 'error';
  services: Record<string, unknown>;
  timestamp: string;
}

export interface HealthAlertEntry {
  event: 'health_alert_sent' | 'health_alert_failed';
  status: 'degraded' | 'error';
  timestamp: string;
  webhook_url: string;
  reason: 'alert_sent' | 'alert_failed';
  error?: string;
}

@Injectable()
export class HealthAlertService {
  private readonly logger = new Logger(HealthAlertService.name);
  private lastAlertAtMs = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REPOSITORY_TOKENS.HEALTH_ALERTS)
    private readonly healthAlertsRepository: IHealthAlertsRepository,
  ) {}

  async notifyIfNeeded(summary: HealthSummaryLike) {
    if (summary.status === 'ok') {
      return {
        triggered: false,
        reason: 'status_ok',
      };
    }

    const webhookUrl = this.configService.get<string>(
      'HEALTH_ALERT_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      return {
        triggered: false,
        reason: 'webhook_not_configured',
      };
    }

    const cooldownMinutes = this.getCooldownMinutes();
    const now = Date.now();
    const cooldownMs = cooldownMinutes * 60 * 1000;

    if (this.lastAlertAtMs > 0 && now - this.lastAlertAtMs < cooldownMs) {
      return {
        triggered: false,
        reason: 'cooldown_active',
        cooldown_minutes: cooldownMinutes,
      };
    }

    const payload = {
      event: 'health.alert',
      source: 'medcore-api',
      status: summary.status,
      timestamp: summary.timestamp,
      services: summary.services,
    };

    try {
      await axios.post(webhookUrl, payload, { timeout: 5000 });
      this.lastAlertAtMs = now;

      this.logger.warn(
        JSON.stringify({
          event: 'health_alert_sent',
          status: summary.status,
          webhook_url: webhookUrl,
          timestamp: new Date(now).toISOString(),
        }),
      );
      await this.healthAlertsRepository.create({
        event: 'health_alert_sent',
        status: summary.status,
        webhook_url: webhookUrl,
        reason: 'alert_sent',
        payload,
      });

      return {
        triggered: true,
        reason: 'alert_sent',
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'health_alert_failed',
          status: summary.status,
          webhook_url: webhookUrl,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          timestamp: new Date(now).toISOString(),
        }),
      );
      await this.healthAlertsRepository.create({
        event: 'health_alert_failed',
        status: summary.status,
        webhook_url: webhookUrl,
        reason: 'alert_failed',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        payload,
      });

      return {
        triggered: false,
        reason: 'alert_failed',
      };
    }
  }

  async listRecentAlerts(limit = 20): Promise<HealthAlertEntry[]> {
    const alerts = await this.healthAlertsRepository.findRecent(limit);
    return alerts.map((alert) => this.toHealthAlertEntry(alert));
  }

  private getCooldownMinutes(): number {
    const configured = this.configService.get<string>(
      'HEALTH_ALERT_COOLDOWN_MINUTES',
    );
    const parsed = Number.parseInt(configured ?? '', 10);

    if (Number.isNaN(parsed) || parsed <= 0) {
      return 10;
    }

    return parsed;
  }

  private toHealthAlertEntry(alert: HealthAlertEventEntity): HealthAlertEntry {
    return {
      event: alert.event as 'health_alert_sent' | 'health_alert_failed',
      status: alert.status as 'degraded' | 'error',
      webhook_url: alert.webhook_url,
      reason: alert.reason as 'alert_sent' | 'alert_failed',
      error: alert.error ?? undefined,
      timestamp: alert.created_at.toISOString(),
    };
  }
}
