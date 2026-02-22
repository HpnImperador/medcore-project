import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsFutureDate } from '../../common/decorators/is-future-date.decorator';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'f10f3f31-93e0-4f74-84cf-3d0864f0529e' })
  @IsUUID()
  branch_id: string;

  @ApiProperty({ example: '8bcb577b-cbb8-4a19-8dca-ef8a8eeead29' })
  @IsUUID()
  patient_id: string;

  @ApiProperty({ example: '6ef3ab38-a6b8-4cb7-9a5a-182e6ffdc5c4' })
  @IsUUID()
  doctor_id: string;

  @ApiProperty({ example: '2026-03-15T14:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  @IsFutureDate({ message: 'A data do agendamento deve ser futura.' })
  scheduled_at: Date;

  @ApiPropertyOptional({ example: 'Paciente com histórico de hipertensão.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
