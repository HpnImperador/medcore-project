import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';
import { HealthAlertService } from './health-alert.service';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    HealthAlertService,
    PrismaService,
    N8nWebhookService,
  ],
})
export class HealthModule {}
