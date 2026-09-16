import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAutomationWorldCupDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ maxLength: 100, default: '' })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;
}
