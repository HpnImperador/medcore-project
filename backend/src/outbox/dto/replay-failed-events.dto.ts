import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ReplayFailedEventsDto {
  @ApiPropertyOptional({
    description:
      'Quantidade máxima de eventos FAILED para reenfileirar (default 50, max 500).',
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Lista opcional de IDs de eventos FAILED para replay seletivo. Se omitido, executa replay em lote.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  event_ids?: string[];

  @ApiPropertyOptional({
    description: 'Motivo operacional para trilha de auditoria.',
    example: 'Reprocessamento após normalização do webhook n8n',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
