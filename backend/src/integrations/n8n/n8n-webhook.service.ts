import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class N8nWebhookService {
  private readonly logger = new Logger(N8nWebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  async notifyAppointmentCompleted(
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
