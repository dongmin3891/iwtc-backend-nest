import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum MediaSize {
  ORIGINAL = 'original',
  DIVIDE_2 = 'divide2',
}

export class GetMediaFileQuery {
  @ApiPropertyOptional({ enum: MediaSize, default: MediaSize.ORIGINAL })
  @IsEnum(MediaSize)
  size: MediaSize = MediaSize.ORIGINAL;
}
