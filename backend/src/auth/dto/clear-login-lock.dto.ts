import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ClearLoginLockDto {
  @ApiProperty({ example: 'medico@medcore.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '192.168.0.50' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  ip: string;
}
