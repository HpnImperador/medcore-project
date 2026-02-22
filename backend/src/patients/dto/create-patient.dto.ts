import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePatientDto {
  @ApiProperty({ example: 'f8f79fe1-c4cf-4d98-b6e5-e5dd574029f4' })
  @IsUUID()
  organization_id: string;

  @ApiProperty({ example: 'Maria de Souza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'maria@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+55 11 99999-9999' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document?: string;

  @ApiPropertyOptional({ example: '1988-04-02T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birth_date?: Date;
}
