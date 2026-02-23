import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsFutureDate } from '../../common/decorators/is-future-date.decorator';

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-03-20T10:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  @IsFutureDate({ message: 'A nova data do agendamento deve ser futura.' })
  scheduled_at: Date;

  @ApiPropertyOptional({ example: 'Reagendado por conflito de agenda médica.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
