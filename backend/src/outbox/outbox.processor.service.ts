import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nWebhookService } from '../integrations/n8n/n8n-webhook.service';
import type {
  IOutboxRepository,
  OutboxEventEntity,
} from '../domain/repositories/outbox.repository.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @Inject(REPOSITORY_TOKENS.OUTBOX)
    private readonly outboxRepository: IOutboxRepository,
    private readonly n8nWebhookService: N8nWebhookService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const pollMs = this.getPositiveIntEnv('OUTBOX_POLL_INTERVAL_MS', 5000);
    this.timer = setInterval(() => {
      void this.processTick();
    }, pollMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processTick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const batchSize = this.getPositiveIntEnv('OUTBOX_BATCH_SIZE', 20);
      const maxAttempts = this.getPositiveIntEnv('OUTBOX_MAX_ATTEMPTS', 10);
      const events = await this.outboxRepository.findProcessable(
        batchSize,
        maxAttempts,
      );

      for (const event of events) {
        await this.processSingleEvent(event);
      }
    } catch (error) {
      this.logger.warn(
        `Falha no processamento do Outbox: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async processSingleEvent(event: OutboxEventEntity): Promise<void> {
    const claimed = await this.outboxRepository.claimForProcessing(event.id);
    if (!claimed) {
      return;
    }

    try {
      await this.dispatchEvent(event);
      await this.outboxRepository.markProcessed(event.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'erro desconhecido';
      await this.outboxRepository.markFailed(event.id, message);
      this.logger.warn(
        `Evento ${event.event_name} (${event.id}) marcado como FAILED: ${message}`,
      );
    }
  }

  private async dispatchEvent(event: OutboxEventEntity): Promise<void> {
    if (!event.event_name.startsWith('appointment.')) {
      return;
    }

    const payload = this.normalizePayload(event.payload);
    await this.n8nWebhookService.notifyAppointmentEvent(payload);
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
    return { raw_payload: payload };
  }

  private getPositiveIntEnv(envName: string, fallback: number): number {
    const raw = this.configService.get<string>(envName);
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
