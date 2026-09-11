import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { VisibilityType } from '../../generated/prisma/enums.js';
import { trimString } from './world-cup-content.validation.js';

export class CreateStaticWorldCupContentDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: '후보 A' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contentsName!: string;

  @ApiProperty({ enum: ['PUBLIC', 'PRIVATE'] })
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibleType!: VisibilityType;
}
