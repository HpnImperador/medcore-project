import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({ example: 'Paciente solicitou cancelamento por indisposição.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
