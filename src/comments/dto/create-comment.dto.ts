import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateCommentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 30,
    example: '재미있는 월드컵이에요!',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  body!: string;

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'guest-a1b2c3' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname!: string;
}
