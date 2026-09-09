import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { VisibilityType } from '../../generated/prisma/enums.js';
import {
  IsYoutubeWatchUrl,
  trimString,
} from './world-cup-content.validation.js';

export class CreateInternetVideoMediaDto {
  @ApiProperty({ enum: ['INTERNET_VIDEO_URL'] })
  @Equals('INTERNET_VIDEO_URL')
  fileType!: 'INTERNET_VIDEO_URL';

  @ApiProperty({
    maxLength: 2048,
    example: 'https://www.youtube.com/watch?v=video-id',
  })
  @Transform(trimString)
  @IsString()
  @MaxLength(2048)
  @IsYoutubeWatchUrl()
  mediaData!: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description:
      '기존 프론트 호환 필드이며 유튜브 후보 저장에는 사용하지 않습니다.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;

  @ApiProperty({ pattern: '^\\d{5}$', example: '00030' })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{5}$/)
  videoStartTime!: string;

  @ApiProperty({ minimum: 3, maximum: 5, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(5)
  videoPlayDuration!: number;

  @ApiProperty({ enum: ['YOU_TUBE_URL'] })
  @Equals('YOU_TUBE_URL')
  detailFileType!: 'YOU_TUBE_URL';
}

export class CreateWorldCupContentDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: '후보 A' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contentsName!: string;

  @ApiProperty({ enum: ['PUBLIC', 'PRIVATE'] })
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibleType!: VisibilityType;

  @ApiProperty({ type: CreateInternetVideoMediaDto })
  @ValidateNested()
  @Type(() => CreateInternetVideoMediaDto)
  createMediaFileRequest!: CreateInternetVideoMediaDto;
}

export class CreateWorldCupContentsDto {
  @ApiProperty({ type: [CreateWorldCupContentDto], minItems: 1, maxItems: 256 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(256)
  @ValidateNested({ each: true })
  @Type(() => CreateWorldCupContentDto)
  data!: CreateWorldCupContentDto[];
}
