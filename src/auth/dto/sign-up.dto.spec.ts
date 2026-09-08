import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignUpDto } from './sign-up.dto.js';

describe('SignUpDto', () => {
  it('normalizes a valid service id and nickname', async () => {
    const dto = plainToInstance(SignUpDto, {
      serviceId: '  User01  ',
      nickname: '  동민  ',
      password: 'Password1!',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.serviceId).toBe('user01');
    expect(dto.nickname).toBe('동민');
  });

  it.each([
    { serviceId: 'short', nickname: '동민', password: 'Password1!' },
    { serviceId: '한글아이디', nickname: '동민', password: 'Password1!' },
    { serviceId: 'member01', nickname: '한 글', password: 'Password1!' },
    { serviceId: 'member01', nickname: '동민', password: 'password!' },
    { serviceId: 'member01', nickname: '동민', password: 'Password1' },
  ])('rejects invalid signup data: %o', async (input) => {
    const dto = plainToInstance(SignUpDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
