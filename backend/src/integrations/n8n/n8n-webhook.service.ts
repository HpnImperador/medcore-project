import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class N8nWebhookService {
  private readonly logger = new Logger(N8nWebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  async healthCheck(): Promise<{
    status: 'up' | 'down' | 'not_configured';
    configured: boolean;
    url: string | null;
    latency_ms?: number;
    http_status?: number;
    error?: string;
  }> {
    const url =
      this.configService.get<string>('N8N_APPOINTMENTS_WEBHOOK_URL') ?? null;

    if (!url) {
      return {
        status: 'not_configured',
        configured: false,
        url: null,
      };
    }

    const startedAt = Date.now();
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true,
      });

      return {
        status: 'up',
        configured: true,
        url,
        latency_ms: Date.now() - startedAt,
        http_status: response.status,
      };
    } catch (error) {
      return {
        status: 'down',
        configured: true,
        url,
        latency_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  async notifyAppointmentCompleted(
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.notifyAppointmentEvent(payload);
  }

  async notifyAppointmentEvent(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const url = this.configService.get<string>('N8N_APPOINTMENTS_WEBHOOK_URL');

    if (!url) {
      this.logger.warn(
        'N8N_APPOINTMENTS_WEBHOOK_URL não configurada. Webhook não disparado.',
      );
      return;
    }

    try {
      await axios.post(url, payload, {
        timeout: 5000,
      });
    } catch {
      this.logger.warn('Falha ao disparar webhook de agendamento para o n8n.');
    }
  }
}
