import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { VisibilityType } from '../../generated/prisma/enums.js';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateManagedWorldCupDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: '최애 캐릭터 월드컵' })
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

  @ApiProperty({ enum: ['PUBLIC', 'PRIVATE'], example: 'PUBLIC' })
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibleType!: VisibilityType;
}
