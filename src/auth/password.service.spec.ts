import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies the password', async () => {
    const hash = await service.hash('Password1!');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(service.verify(hash, 'Password1!')).resolves.toBe(true);
    await expect(service.verify(hash, 'WrongPassword1!')).resolves.toBe(false);
  });

  it('treats a malformed stored hash as a failed verification', async () => {
    await expect(service.verify('not-a-hash', 'Password1!')).resolves.toBe(
      false,
    );
  });
});
