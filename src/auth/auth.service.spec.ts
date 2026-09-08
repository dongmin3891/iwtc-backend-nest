import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

const config = new ConfigService({
  JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-characters',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2592000,
});

describe('AuthService', () => {
  const member = {
    id: 7,
    serviceId: 'member01',
    nickname: '동민',
    passwordHash: 'stored-hash',
  };

  function createFixture(options?: { passwordMatches?: boolean }) {
    const sessions = new Map<
      string,
      {
        id: string;
        familyId: string;
        memberId: number;
        tokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
        replacedBySessionId?: string | null;
      }
    >();
    const memberCreate = vi.fn().mockResolvedValue(member);
    const authSession = {
      create: vi.fn().mockImplementation(({ data }) => {
        sessions.set(data.id, { ...data, revokedAt: null });
        return Promise.resolve(data);
      }),
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(sessions.get(where.id) ?? null),
        ),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const session = sessions.get(where.id);
        if (
          !session ||
          session.memberId !== where.memberId ||
          session.revokedAt ||
          session.expiresAt <= where.expiresAt.gt
        ) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          member: {
            id: member.id,
            serviceId: member.serviceId,
            nickname: member.nickname,
          },
        });
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        for (const session of sessions.values()) {
          const matchesId = where.id === undefined || session.id === where.id;
          const matchesFamily =
            where.familyId === undefined || session.familyId === where.familyId;
          const matchesHash =
            where.tokenHash === undefined ||
            session.tokenHash === where.tokenHash;
          const matchesRevoked =
            where.revokedAt !== null || session.revokedAt === null;
          if (matchesId && matchesFamily && matchesHash && matchesRevoked) {
            Object.assign(session, data);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    };
    const prisma = {
      member: {
        create: memberCreate,
        findUnique: vi.fn().mockResolvedValue(member),
      },
      authSession,
      $transaction: vi
        .fn()
        .mockImplementation((operation) => operation({ authSession })),
    };
    const passwords = {
      hash: vi.fn().mockResolvedValue('stored-hash'),
      verify: vi.fn().mockResolvedValue(options?.passwordMatches ?? true),
    };
    const service = new AuthService(
      prisma as never,
      new JwtService(),
      passwords as unknown as PasswordService,
      config,
    );

    return { service, prisma, passwords, sessions };
  }

  it('stores only the password hash when signing up', async () => {
    const { service, prisma, passwords } = createFixture();

    await service.signUp({
      serviceId: 'member01',
      nickname: '동민',
      password: 'Password1!',
    });

    expect(passwords.hash).toHaveBeenCalledWith('Password1!');
    expect(prisma.member.create).toHaveBeenCalledWith({
      data: {
        serviceId: 'member01',
        nickname: '동민',
        passwordHash: 'stored-hash',
      },
    });
  });

  it('returns the same 401 for an unknown id and a wrong password', async () => {
    const unknown = createFixture();
    unknown.prisma.member.findUnique.mockResolvedValueOnce(null);
    const wrong = createFixture({ passwordMatches: false });

    await expect(
      unknown.service.signIn({
        serviceId: 'unknown1',
        password: 'Password1!',
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
    expect(unknown.passwords.verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'Password1!',
    );
    await expect(
      wrong.service.signIn({
        serviceId: 'member01',
        password: 'Password1!',
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
  });

  it('creates a session, authorizes access, and rotates refresh tokens', async () => {
    const { service, sessions } = createFixture();
    const first = await service.signIn({
      serviceId: 'member01',
      password: 'Password1!',
    });

    await expect(service.authorizeAccess(first.accessToken)).resolves.toEqual({
      id: 7,
      serviceId: 'member01',
      nickname: '동민',
    });

    const next = await service.refresh(first.refreshToken);
    expect(next.accessToken).not.toBe(first.accessToken);
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(
      [...sessions.values()].filter((item) => !item.revokedAt),
    ).toHaveLength(1);

    await expect(
      service.authorizeAccess(first.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.authorizeAccess(next.accessToken),
    ).resolves.toMatchObject({
      id: 7,
    });
  });

  it('revokes the token family when an old refresh token is reused', async () => {
    const { service, sessions } = createFixture();
    const first = await service.signIn({
      serviceId: 'member01',
      password: 'Password1!',
    });
    const next = await service.refresh(first.refreshToken);

    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect([...sessions.values()].every((item) => item.revokedAt)).toBe(true);
    await expect(
      service.authorizeAccess(next.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the active session family on sign out', async () => {
    const { service, sessions } = createFixture();
    const tokens = await service.signIn({
      serviceId: 'member01',
      password: 'Password1!',
    });

    await service.signOut(tokens.refreshToken);

    expect([...sessions.values()].every((item) => item.revokedAt)).toBe(true);
    await expect(
      service.authorizeAccess(tokens.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
