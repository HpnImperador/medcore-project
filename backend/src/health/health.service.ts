import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';
import { HealthAlertService } from './health-alert.service';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';

type HealthStatus = 'ok' | 'degraded' | 'error';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nWebhookService: N8nWebhookService,
    private readonly healthAlertService: HealthAlertService,
    private readonly configService: ConfigService,
    @Inject(REPOSITORY_TOKENS.OUTBOX)
    private readonly outboxRepository: IOutboxRepository,
  ) {}

  async checkDatabase() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'up' as const,
        latency_ms: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down' as const,
        latency_ms: Date.now() - startedAt,
        error: this.getErrorMessage(error),
      };
    }
  }

  async checkN8n() {
    return this.n8nWebhookService.healthCheck();
  }

  async checkOutbox() {
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

    const status = this.computeOutboxStatus(metrics, thresholds);
    return {
      status,
      metrics,
      thresholds,
      timestamp: new Date().toISOString(),
    };
  }

  getMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      process_uptime_seconds: Math.floor(process.uptime()),
      memory: {
        rss: memoryUsage.rss,
        heap_total: memoryUsage.heapTotal,
        heap_used: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      node_version: process.version,
      timestamp: new Date().toISOString(),
    };
  }

  async getHealthSummary() {
    const [database, n8n, outbox] = await Promise.all([
      this.checkDatabase(),
      this.checkN8n(),
      this.checkOutbox(),
    ]);

    const status = this.computeOverallStatus(
      database.status,
      n8n.status,
      outbox.status,
    );
    return {
      status,
      services: {
        database,
        n8n,
        outbox,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async checkAndNotify() {
    const summary = await this.getHealthSummary();
    const alert = await this.healthAlertService.notifyIfNeeded(summary);

    return {
      ...summary,
      alert,
    };
  }

  async getRecentAlerts(limit?: number) {
    return this.healthAlertService.listRecentAlerts(limit);
  }

  private computeOverallStatus(
    databaseStatus: 'up' | 'down',
    n8nStatus: 'up' | 'down' | 'not_configured',
    outboxStatus: 'up' | 'degraded' | 'error',
  ): HealthStatus {
    if (databaseStatus === 'down' || outboxStatus === 'error') {
      return 'error';
    }

    if (
      n8nStatus === 'down' ||
      n8nStatus === 'not_configured' ||
      outboxStatus === 'degraded'
    ) {
      return 'degraded';
    }

    return 'ok';
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Erro desconhecido';
  }
}
