import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { OutboxEventStatus } from '../../domain/repositories/outbox.repository.interface';

const OUTBOX_STATUSES: OutboxEventStatus[] = [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
];

export class ListOutboxEventsDto {
  @ApiPropertyOptional({
    description: 'Filtra por status do evento no Outbox.',
    enum: OUTBOX_STATUSES,
    example: 'FAILED',
  })
  @IsOptional()
  @IsIn(OUTBOX_STATUSES)
  status?: OutboxEventStatus;

  @ApiPropertyOptional({
    description: 'Filtra por nome exato do evento.',
    example: 'appointment.completed',
  })
  @IsOptional()
  @IsString()
  event_name?: string;

  @ApiPropertyOptional({
    description: 'Filtra por correlation_id.',
    example: 'e46c1f03-f640-4ed5-85b8-27c2401698d0',
  })
  @IsOptional()
  @IsString()
  correlation_id?: string;

  @ApiPropertyOptional({
    description:
      'Quantidade máxima de registros retornados (default 50, max 200).',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
