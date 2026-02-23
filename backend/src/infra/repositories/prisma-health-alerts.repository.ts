import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateHealthAlertEventInput,
  HealthAlertEventEntity,
  IHealthAlertsRepository,
} from '../../domain/repositories/health-alerts.repository.interface';

interface HealthAlertsDelegate {
  create(args: {
    data: {
      event: string;
      status: string;
      webhook_url: string;
      reason: string;
      error?: string | null;
      payload?: Record<string, unknown> | null;
    };
  }): Promise<HealthAlertEventEntity>;
  findMany(args: {
    take: number;
    orderBy: {
      created_at: 'asc' | 'desc';
    };
  }): Promise<HealthAlertEventEntity[]>;
}

interface PrismaWithHealthAlerts {
  health_alert_events: HealthAlertsDelegate;
}

@Injectable()
export class PrismaHealthAlertsRepository implements IHealthAlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateHealthAlertEventInput): Promise<HealthAlertEventEntity> {
    return this.healthAlertsDelegate.create({
      data: {
        event: input.event,
        status: input.status,
        webhook_url: input.webhook_url,
        reason: input.reason,
        error: input.error,
        payload: input.payload,
      },
    });
  }

  findRecent(limit: number): Promise<HealthAlertEventEntity[]> {
    const normalizedLimit = Number.isNaN(limit) || limit <= 0 ? 20 : limit;

    return this.healthAlertsDelegate.findMany({
      take: Math.min(normalizedLimit, 100),
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  private get healthAlertsDelegate(): HealthAlertsDelegate {
    return (this.prisma as unknown as PrismaWithHealthAlerts)
      .health_alert_events;
  }
}
