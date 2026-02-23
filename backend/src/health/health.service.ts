import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';

type HealthStatus = 'ok' | 'degraded' | 'error';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nWebhookService: N8nWebhookService,
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
    const [database, n8n] = await Promise.all([
      this.checkDatabase(),
      this.checkN8n(),
    ]);

    const status = this.computeOverallStatus(database.status, n8n.status);
    return {
      status,
      services: {
        database,
        n8n,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private computeOverallStatus(
    databaseStatus: 'up' | 'down',
    n8nStatus: 'up' | 'down' | 'not_configured',
  ): HealthStatus {
    if (databaseStatus === 'down') {
      return 'error';
    }

    if (n8nStatus === 'down' || n8nStatus === 'not_configured') {
      return 'degraded';
    }

    return 'ok';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Erro desconhecido';
  }
}
