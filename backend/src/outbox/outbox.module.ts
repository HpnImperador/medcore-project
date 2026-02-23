import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import { PrismaOutboxRepository } from '../infra/repositories/prisma-outbox.repository';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';
import { OutboxProcessorService } from './outbox.processor.service';
import { OutboxAdminController } from './outbox-admin.controller';
import { OutboxAdminService } from './outbox-admin.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  controllers: [OutboxAdminController],
  imports: [ConfigModule],
  providers: [
    PrismaService,
    N8nWebhookService,
    OutboxProcessorService,
    OutboxAdminService,
    JwtStrategy,
    RolesGuard,
    {
      provide: REPOSITORY_TOKENS.OUTBOX,
      useClass: PrismaOutboxRepository,
    },
  ],
})
export class OutboxModule {}
