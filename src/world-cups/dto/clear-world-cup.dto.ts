import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  SUPPORTED_ROUNDS,
  type SupportedRound,
} from '../world-cups.constants.js';

export class GamePlacementDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentsId!: number;

  @ApiProperty({ minimum: 1, maximum: 4, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  rank!: number;
}

@ValidatorConstraint({ name: 'validPlacementsForRound', async: false })
class ValidPlacementsForRoundConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, arguments_: ValidationArguments): boolean {
    if (!Array.isArray(value)) {
      return true;
    }

    const request = arguments_.object as ClearWorldCupDto;
    if (!SUPPORTED_ROUNDS.includes(request.round as SupportedRound)) {
      return true;
    }

    const expectedRanks = request.round === 2 ? [1, 2] : [1, 2, 3, 4];
    if (value.length !== expectedRanks.length) {
      return false;
    }

    const placements = value.filter(
      (item): item is GamePlacementDto =>
        typeof item === 'object' && item !== null,
    );
    if (placements.length !== value.length) {
      return false;
    }

    const contentsIds = placements.map((item) => item.contentsId);
    const ranks = placements.map((item) => item.rank).sort((a, b) => a - b);

    return (
      new Set(contentsIds).size === contentsIds.length &&
      ranks.every((rank, index) => rank === expectedRanks[index])
    );
  }

  defaultMessage(arguments_: ValidationArguments): string {
    const request = arguments_.object as ClearWorldCupDto;
    const ranks = request.round === 2 ? '1위와 2위' : '1위부터 4위';
    return `placements에는 중복되지 않은 후보로 ${ranks}를 각각 한 번씩 입력해야 합니다.`;
  }
}

export class ClearWorldCupDto {
  @ApiProperty({
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  playId!: string;

  @ApiProperty({ enum: SUPPORTED_ROUNDS, example: 4 })
  @Type(() => Number)
  @IsInt()
  @IsIn(SUPPORTED_ROUNDS)
  round!: SupportedRound;

  @ApiProperty({
    type: GamePlacementDto,
    isArray: true,
    minItems: 2,
    maxItems: 4,
    description: '2강은 1·2위, 나머지 라운드는 1~4위를 입력합니다.',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GamePlacementDto)
  @Validate(ValidPlacementsForRoundConstraint)
  placements!: GamePlacementDto[];
}
