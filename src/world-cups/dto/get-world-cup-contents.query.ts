import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsInt, Max, Min } from 'class-validator';
import { SUPPORTED_ROUNDS } from '../world-cups.constants.js';

export class GetWorldCupContentsQuery {
  @ApiProperty({ enum: SUPPORTED_ROUNDS, example: 4 })
  @Type(() => Number)
  @IsInt()
  @IsIn(SUPPORTED_ROUNDS)
  currentRound!: number;

  @ApiProperty({ minimum: 1, maximum: 4, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  sliceContents!: number;

  @ApiPropertyOptional({
    description: '조회에서 제외할 후보 ID를 쉼표로 구분한 값',
    example: '1,2',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') {
      return [];
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values.map((item) => Number(String(item).trim()));
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  excludeContentsIds: number[] = [];
}
