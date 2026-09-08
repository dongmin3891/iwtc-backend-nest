import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants.js';
import type {
  AccessTokenPayload,
  IssuedTokens,
  MemberSummary,
  RefreshTokenPayload,
} from './auth.types.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { PasswordService } from './password.service.js';

const INVALID_CREDENTIALS_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';
const INVALID_SESSION_MESSAGE = '로그인이 만료되었습니다. 다시 로그인해주세요.';
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$a7eu+wXt75e6fOWGvoBbYg$XfFdpMLJCwmusUhazVu3aV+DM+wVNI+sn/bWJVLqBzY';

class RefreshTokenReuseError extends Error {}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtlSeconds = config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    this.refreshTtlSeconds = config.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );
  }

  async signUp(request: SignUpDto): Promise<void> {
    const passwordHash = await this.passwords.hash(request.password);

    try {
      await this.prisma.member.create({
        data: {
          serviceId: request.serviceId,
          nickname: request.nickname,
          passwordHash,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('이미 사용 중인 아이디 또는 닉네임입니다.');
      }
      throw error;
    }
  }

  async signIn(request: SignInDto): Promise<IssuedTokens> {
    const member = await this.prisma.member.findUnique({
      where: { serviceId: request.serviceId },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    const passwordMatches = await this.passwords.verify(
      member?.passwordHash ?? DUMMY_PASSWORD_HASH,
      request.password,
    );
    if (!member || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.createSession(member.id);
  }

  async authorizeAccess(accessToken: string): Promise<MemberSummary> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
        secret: this.accessSecret,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (
      payload.type !== 'access' ||
      !Number.isInteger(payload.sub) ||
      typeof payload.sid !== 'string'
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        memberId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        member: {
          select: {
            id: true,
            serviceId: true,
            nickname: true,
          },
        },
      },
    });
    if (!session) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return session.member;
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.jti },
      select: {
        id: true,
        familyId: true,
        memberId: true,
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    const tokenHash = this.hashToken(refreshToken);
    if (
      !session ||
      session.familyId !== payload.familyId ||
      session.memberId !== payload.sub ||
      session.tokenHash !== tokenHash ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      await this.revokeFamily(payload.familyId);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const nextSessionId = randomUUID();
    const nextTokens = await this.signTokens(
      session.memberId,
      nextSessionId,
      session.familyId,
    );
    const now = new Date();

    try {
      await this.prisma.$transaction(async (transaction) => {
        const revoked = await transaction.authSession.updateMany({
          where: {
            id: session.id,
            tokenHash,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            replacedBySessionId: nextSessionId,
          },
        });
        if (revoked.count !== 1) {
          throw new RefreshTokenReuseError();
        }

        await transaction.authSession.create({
          data: {
            id: nextSessionId,
            familyId: session.familyId,
            memberId: session.memberId,
            tokenHash: this.hashToken(nextTokens.refreshToken),
            expiresAt: this.refreshExpiresAt(now),
          },
        });
      });
    } catch (error) {
      if (error instanceof RefreshTokenReuseError) {
        await this.revokeFamily(session.familyId);
        throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
      }
      throw error;
    }

    return nextTokens;
  }

  async signOut(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          ignoreExpiration: true,
        },
      );
      if (payload.type === 'refresh' && typeof payload.familyId === 'string') {
        await this.revokeFamily(payload.familyId);
      }
    } catch {
      // 로그아웃은 쿠키 정리가 목적이므로 유효하지 않은 토큰도 동일하게 처리한다.
    }
  }

  private async createSession(memberId: number): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const tokens = await this.signTokens(memberId, sessionId, familyId);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        familyId,
        memberId,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.refreshExpiresAt(),
      },
    });

    return tokens;
  }

  private async signTokens(
    memberId: number,
    sessionId: string,
    familyId: string,
  ): Promise<IssuedTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: memberId, sid: sessionId, type: 'access' },
        {
          secret: this.accessSecret,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: this.accessTtlSeconds,
        },
      ),
      this.jwt.signAsync(
        {
          sub: memberId,
          jti: sessionId,
          familyId,
          type: 'refresh',
        },
        {
          secret: this.refreshSecret,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: this.refreshTtlSeconds,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (
      payload.type !== 'refresh' ||
      !Number.isInteger(payload.sub) ||
      typeof payload.jti !== 'string' ||
      typeof payload.familyId !== 'string'
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    return payload;
  }

  private revokeFamily(familyId: string): Promise<{ count: number }> {
    return this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private refreshExpiresAt(from = new Date()): Date {
    return new Date(from.getTime() + this.refreshTtlSeconds * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
