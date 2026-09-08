import { Transform } from 'class-transformer';
import { IsAlphanumeric, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_PATTERN } from './sign-up.dto.js';

export class SignInDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(6, 10, { message: '아이디는 6~10자로 입력해주세요.' })
  @IsAlphanumeric('en-US', {
    message: '아이디는 영문과 숫자만 사용할 수 있습니다.',
  })
  serviceId: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message: '비밀번호는 8~16자의 영문, 숫자, 특수문자를 각각 포함해야 합니다.',
  })
  password: string;
}
