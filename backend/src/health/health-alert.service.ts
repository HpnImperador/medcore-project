import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface HealthSummaryLike {
  status: 'ok' | 'degraded' | 'error';
  services: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class HealthAlertService {
  private readonly logger = new Logger(HealthAlertService.name);
  private lastAlertAtMs = 0;

  constructor(private readonly configService: ConfigService) {}

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

      return {
        triggered: false,
        reason: 'alert_failed',
      };
    }
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
}
