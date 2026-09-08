import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureApp } from '../src/configure-app.js';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  const authService = {
    signUp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
    }),
    authorizeAccess: vi.fn().mockResolvedValue({
      id: 1,
      serviceId: 'member01',
      nickname: '동민',
    }),
    refresh: vi.fn().mockResolvedValue({
      accessToken: 'new-access-token-value',
      refreshToken: 'new-refresh-token-value',
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const config = new ConfigService({
      NODE_ENV: 'test',
      CORS_ORIGINS: ['http://localhost:3000'],
      JWT_REFRESH_TTL_SECONDS: 2592000,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AccessTokenGuard,
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/members/sign-up validates and normalizes input', async () => {
    await request(app.getHttpServer())
      .post('/api/members/sign-up')
      .send({
        serviceId: '  Member01 ',
        nickname: ' 동민 ',
        password: 'Password1!',
      })
      .expect(201)
      .expect({ code: 1, message: '가입 성공', data: null });

    expect(authService.signUp).toHaveBeenCalledWith({
      serviceId: 'member01',
      nickname: '동민',
      password: 'Password1!',
    });
  });

  it('rejects invalid signup data before calling the service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/members/sign-up')
      .send({
        serviceId: '한글',
        nickname: 'a',
        password: 'password',
      })
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
    expect(authService.signUp).not.toHaveBeenCalled();
  });

  it('POST /api/members/sign-in returns access header and HttpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/members/sign-in')
      .send({ serviceId: 'member01', password: 'Password1!' })
      .expect(200)
      .expect('access-token', 'access-token-value')
      .expect({ code: 1, message: '로그인 성공', data: null });

    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('IWTC_REFRESH_TOKEN=refresh-token-value');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Path=/api');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(JSON.stringify(response.body)).not.toContain('refresh-token-value');
  });

  it('GET /api/members/me/summary requires and resolves the access token', async () => {
    await request(app.getHttpServer())
      .get('/api/members/me/summary')
      .set('access-token', 'access-token-value')
      .expect(200)
      .expect({
        code: 1,
        message: '회원 정보 조회 성공',
        data: { id: 1, serviceId: 'member01', nickname: '동민' },
      });

    expect(authService.authorizeAccess).toHaveBeenCalledWith(
      'access-token-value',
    );
  });

  it('POST /api/new-access-token rotates the cookie without exposing it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/new-access-token')
      .set('Cookie', 'IWTC_REFRESH_TOKEN=refresh-token-value')
      .expect(200)
      .expect({
        code: 1,
        message: '토큰 갱신 성공',
        data: { newAccessToken: 'new-access-token-value' },
      });

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token-value');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain(
      'IWTC_REFRESH_TOKEN=new-refresh-token-value',
    );
    expect(JSON.stringify(response.body)).not.toContain(
      'new-refresh-token-value',
    );
  });

  it('POST /api/new-access-token rejects a missing cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/new-access-token')
      .expect(401)
      .expect({
        code: -1,
        message: '로그인이 만료되었습니다. 다시 로그인해주세요.',
        data: null,
      });
  });

  it('POST /api/members/sign-out revokes the family and clears the cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/members/sign-out')
      .set('Cookie', 'IWTC_REFRESH_TOKEN=refresh-token-value')
      .expect(204);

    expect(authService.signOut).toHaveBeenCalledWith('refresh-token-value');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('IWTC_REFRESH_TOKEN=');
    expect(cookies[0]).toContain('Expires=Thu, 01 Jan 1970');
  });

  afterAll(async () => {
    await app.close();
  });
});
