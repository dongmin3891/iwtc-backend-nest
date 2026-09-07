import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DateRange {
  ALL = 'ALL',
  YEAR = 'YEAR',
  MONTH = 'MONTH',
  DAY = 'DAY',
}

export class ListWorldCupsQuery {
  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  @ApiPropertyOptional({ default: 'id,DESC', enum: ['id,DESC', 'views,DESC'] })
  @IsIn(['id,DESC', 'views,DESC'])
  sort: 'id,DESC' | 'views,DESC' = 'id,DESC';

  @ApiPropertyOptional({ minLength: 1, maxLength: 10 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  keyword?: string;

  @ApiPropertyOptional({ enum: DateRange, default: DateRange.ALL })
  @IsEnum(DateRange)
  dateRange: DateRange = DateRange.ALL;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  memberId?: number;
}
