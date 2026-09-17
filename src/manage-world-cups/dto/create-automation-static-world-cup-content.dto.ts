import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateStaticWorldCupContentDto } from './create-static-world-cup-content.dto.js';
import { trimString } from './world-cup-content.validation.js';

export class CreateAutomationStaticWorldCupContentDto extends CreateStaticWorldCupContentDto {
  @ApiProperty({ enum: ['PEXELS'] })
  @IsIn(['PEXELS'])
  sourceProvider!: 'PEXELS';

  @ApiProperty({ example: '4731094', maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sourceExternalId!: string;

  @ApiProperty({ example: 'https://www.pexels.com/photo/example-4731094/' })
  @Transform(trimString)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/(?:www\.)?pexels\.com\/photo\/[^/?#]+\/?$/i, {
    message: 'sourceUrl must be a Pexels photo URL',
  })
  @MaxLength(2048)
  sourceUrl!: string;

  @ApiProperty({ example: 'Helena Lopes', maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sourceAuthor!: string;

  @ApiProperty({ example: 'https://www.pexels.com/@helenalopes' })
  @Transform(trimString)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/(?:www\.)?pexels\.com\/@[^/?#]+\/?$/i, {
    message: 'sourceAuthorUrl must be a Pexels author URL',
  })
  @MaxLength(2048)
  sourceAuthorUrl!: string;
}
