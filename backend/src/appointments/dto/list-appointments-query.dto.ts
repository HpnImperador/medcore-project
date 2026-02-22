import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({ example: 'f10f3f31-93e0-4f74-84cf-3d0864f0529e' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    example: 'SCHEDULED',
    enum: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED'],
  })
  @IsOptional()
  @IsIn(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELED'])
  status?: string;
}
