import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CleanupOutboxAuditsDto {
  @ApiPropertyOptional({
    description: 'Retenção em dias para remover auditorias antigas.',
    example: 90,
    default: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retention_days?: number;

  @ApiPropertyOptional({
    description:
      'Quando true, apenas simula a limpeza sem deletar fisicamente.',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dry_run?: boolean;
}
