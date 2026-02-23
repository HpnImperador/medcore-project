import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';

@Injectable()
export class OutboxMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @Inject(REPOSITORY_TOKENS.OUTBOX)
    private readonly outboxRepository: IOutboxRepository,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.getBooleanEnv('OUTBOX_AUTO_CLEANUP_ENABLED', false);
    if (!enabled) {
      this.logger.log(
        'OUTBOX_AUTO_CLEANUP_ENABLED=false. Limpeza automática desativada.',
      );
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const allowNonProd = this.getBooleanEnv(
      'OUTBOX_AUTO_CLEANUP_ALLOW_NON_PROD',
      false,
    );

    if (nodeEnv !== 'production' && !allowNonProd) {
      this.logger.warn(
        `Limpeza automática bloqueada em NODE_ENV=${nodeEnv}. Defina OUTBOX_AUTO_CLEANUP_ALLOW_NON_PROD=true para habilitar fora de produção.`,
      );
      return;
    }

    const intervalMs = this.getPositiveIntEnv(
      'OUTBOX_AUTO_CLEANUP_INTERVAL_MS',
      24 * 60 * 60 * 1000,
    );

    this.timer = setInterval(() => {
      void this.runCleanupCycle();
    }, intervalMs);

    const runOnStart = this.getBooleanEnv(
      'OUTBOX_AUTO_CLEANUP_RUN_ON_START',
      false,
    );
    if (runOnStart) {
      void this.runCleanupCycle();
    }

    this.logger.log(
      `Limpeza automática do Outbox habilitada (intervalo=${intervalMs}ms).`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCleanupCycle(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const retentionDays = this.getPositiveIntEnv(
        'OUTBOX_AUTO_CLEANUP_RETENTION_DAYS',
        30,
      );
      const includeFailed = this.getBooleanEnv(
        'OUTBOX_AUTO_CLEANUP_INCLUDE_FAILED',
        false,
      );
      const dryRun = this.getBooleanEnv('OUTBOX_AUTO_CLEANUP_DRY_RUN', true);
      const requestedByUserId = this.getMaintenanceUserId();

      const organizations =
        await this.outboxRepository.listOrganizationsWithEvents();
      if (organizations.length === 0) {
        this.logger.log(
          'Sem organizações com eventos no Outbox para limpeza automática.',
        );
        return;
      }

      let totalAffected = 0;

      for (const organizationId of organizations) {
        const result = await this.outboxRepository.cleanupEvents({
          organization_id: organizationId,
          requested_by_user_id: requestedByUserId,
          retention_days: retentionDays,
          include_failed: includeFailed,
          dry_run: dryRun,
        });

        totalAffected += result.deleted_count;
      }

      this.logger.log(
        `Limpeza automática do Outbox concluída. orgs=${organizations.length}, afetados=${totalAffected}, dry_run=${dryRun}, retention_days=${retentionDays}, include_failed=${includeFailed}.`,
      );
    } catch (error) {
      this.logger.warn(
        `Falha na limpeza automática do Outbox: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private getMaintenanceUserId(): string {
    const configured = this.configService.get<string>(
      'OUTBOX_MAINTENANCE_SYSTEM_USER_ID',
    );
    const fallback = '00000000-0000-0000-0000-000000000000';

    if (configured && this.isUuid(configured)) {
      return configured;
    }

    this.logger.warn(
      'OUTBOX_MAINTENANCE_SYSTEM_USER_ID ausente/inválido. Usando UUID técnico padrão para auditoria.',
    );
    return fallback;
  }

  private isUuid(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  private getPositiveIntEnv(envName: string, fallback: number): number {
    const raw = this.configService.get<string>(envName);
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private getBooleanEnv(envName: string, fallback: boolean): boolean {
    const raw = (this.configService.get<string>(envName) ?? '')
      .trim()
      .toLowerCase();
    if (raw === 'true' || raw === '1' || raw === 'yes') {
      return true;
    }
    if (raw === 'false' || raw === '0' || raw === 'no') {
      return false;
    }
    return fallback;
  }
}
