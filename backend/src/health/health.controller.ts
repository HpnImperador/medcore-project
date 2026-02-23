import { Controller, Get } from '@nestjs/common';
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
}
