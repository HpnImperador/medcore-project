import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CleanupOutboxEventsDto {
  @ApiPropertyOptional({
    description:
      'Retenção em dias para considerar eventos antigos elegíveis à limpeza.',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retention_days?: number;

  @ApiPropertyOptional({
    description:
      'Quando true, inclui eventos FAILED na limpeza. Por padrão, limpa apenas PROCESSED.',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  include_failed?: boolean;

  @ApiPropertyOptional({
    description:
      'Quando true, simula sem deletar fisicamente; quando false, executa a limpeza.',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dry_run?: boolean;
}
