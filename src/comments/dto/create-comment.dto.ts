import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 50,
    example: 'guest-a1b2c3',
    description: '비회원 댓글일 때 필수입니다.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nickname?: string;
}
