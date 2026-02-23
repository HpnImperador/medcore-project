import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListOutboxReplayAuditDto {
  @ApiPropertyOptional({
    description:
      'Quantidade máxima de registros de auditoria retornados (default 20, max 200).',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
