import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class GetAvailableSlotsQueryDto {
  @ApiProperty({ example: 'f10f3f31-93e0-4f74-84cf-3d0864f0529e' })
  @IsUUID()
  branch_id: string;

  @ApiProperty({ example: '6ef3ab38-a6b8-4cb7-9a5a-182e6ffdc5c4' })
  @IsUUID()
  doctor_id: string;

  @ApiProperty({
    example: '2026-03-20T00:00:00.000Z',
    description: 'Data-base em UTC para cálculo dos slots do dia.',
  })
  @Type(() => Date)
  @IsDate()
  date: Date;
}
