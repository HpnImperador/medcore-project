import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Resumo de saúde da API (DB + n8n)',
  })
  @ApiOkResponse({ description: 'Resumo de saúde retornado com sucesso.' })
  async summary() {
    return this.healthService.getHealthSummary();
  }

  @Get('db')
  @ApiOperation({
    summary: 'Saúde da conexão com banco PostgreSQL',
  })
  @ApiOkResponse({
    description: 'Status da conexão com banco retornado com sucesso.',
  })
  async db() {
    return this.healthService.checkDatabase();
  }

  @Get('n8n')
  @ApiOperation({
    summary: 'Saúde de conectividade do webhook n8n',
  })
  @ApiOkResponse({
    description: 'Status de conectividade do n8n retornado com sucesso.',
  })
  async n8n() {
    return this.healthService.checkN8n();
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Métricas básicas de processo (uptime e memória)',
  })
  @ApiOkResponse({
    description: 'Métricas básicas do processo retornadas com sucesso.',
  })
  metrics() {
    return this.healthService.getMetrics();
  }

  @Get('outbox')
  @ApiOperation({
    summary:
      'Métricas operacionais do Outbox (pendentes, failed e latência de processamento)',
  })
  @ApiOkResponse({
    description: 'Métricas do Outbox retornadas com sucesso.',
  })
  async outbox() {
    return this.healthService.checkOutbox();
  }

  @Get('alert-check')
  @ApiOperation({
    summary:
      'Executa healthcheck consolidado e dispara alerta se status estiver degraded/error',
  })
  @ApiOkResponse({
    description: 'Verificação de alerta operacional executada com sucesso.',
  })
  async alertCheck() {
    return this.healthService.checkAndNotify();
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Lista histórico recente de alertas operacionais disparados',
  })
  @ApiOkResponse({
    description: 'Histórico de alertas retornado com sucesso.',
  })
  async alerts(@Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.healthService.getRecentAlerts(parsed);
  }
}
