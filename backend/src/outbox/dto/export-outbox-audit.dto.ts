import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

const AUDIT_TYPES = ['replay', 'maintenance'] as const;
const EXPORT_FORMATS = ['json', 'csv'] as const;

export class ExportOutboxAuditDto {
  @ApiPropertyOptional({
    description: 'Tipo da auditoria que será exportada.',
    enum: AUDIT_TYPES,
    default: 'maintenance',
  })
  @IsOptional()
  @IsIn(AUDIT_TYPES)
  type?: (typeof AUDIT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Formato de exportação.',
    enum: EXPORT_FORMATS,
    default: 'json',
  })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: (typeof EXPORT_FORMATS)[number];

  @ApiPropertyOptional({
    description: 'Filtro de data inicial (ISO 8601) para created_at.',
    example: '2026-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filtro de data final (ISO 8601) para created_at.',
    example: '2026-02-23T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Quantidade máxima de registros exportados (default 1000, max 5000).',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
