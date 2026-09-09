import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureApp } from '../src/configure-app.js';
import { ManageWorldCupsController } from '../src/manage-world-cups/manage-world-cups.controller.js';
import { ManageWorldCupsService } from '../src/manage-world-cups/manage-world-cups.service.js';

describe('Manage world cups API (e2e)', () => {
  let app: INestApplication<App>;
  const manageWorldCupsService = {
    findAll: vi.fn().mockResolvedValue([
      {
        worldCupId: 3,
        title: '내 월드컵',
        description: '설명',
        visibleType: 'PRIVATE',
      },
    ]),
    findOne: vi.fn().mockResolvedValue({
      worldCupId: 3,
      title: '내 월드컵',
      description: '설명',
      visibleType: 'PRIVATE',
      createdAt: new Date('2026-09-09T00:00:00.000Z'),
      updatedAt: new Date('2026-09-09T01:00:00.000Z'),
    }),
    create: vi.fn().mockResolvedValue(11),
  };
  const authService = {
    authorizeAccess: vi.fn().mockResolvedValue({
      id: 7,
      serviceId: 'member07',
      nickname: '동민',
    }),
  };

  beforeAll(async () => {
    const config = new ConfigService({
      CORS_ORIGINS: ['http://localhost:3000'],
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ManageWorldCupsController],
      providers: [
        AccessTokenGuard,
        { provide: AuthService, useValue: authService },
        {
          provide: ManageWorldCupsService,
          useValue: manageWorldCupsService,
        },
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

  it('requires authentication for the management APIs', async () => {
    await request(app.getHttpServer())
      .get('/api/me/game-manage/world-cups')
      .expect(401)
      .expect({ code: -1, message: '로그인이 필요합니다.', data: null });

    expect(manageWorldCupsService.findAll).not.toHaveBeenCalled();
  });

  it('returns only the authenticated member world cups', async () => {
    await request(app.getHttpServer())
      .get('/api/me/game-manage/world-cups')
      .set('access-token', 'valid-token')
      .expect(200)
      .expect({
        code: 1,
        message: '자신의 게임 리스트 조회',
        data: [
          {
            worldCupId: 3,
            title: '내 월드컵',
            description: '설명',
            visibleType: 'PRIVATE',
          },
        ],
      });

    expect(manageWorldCupsService.findAll).toHaveBeenCalledWith(7);
  });

  it('returns an owned world cup detail', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/me/game-manage/world-cups/3')
      .set('access-token', 'valid-token')
      .expect(200);

    expect(response.body).toMatchObject({
      code: 1,
      message: '자신의 월드컵 조회',
      data: { worldCupId: 3, title: '내 월드컵' },
    });
    expect(manageWorldCupsService.findOne).toHaveBeenCalledWith(7, 3);
  });

  it('creates an owned world cup with normalized input', async () => {
    await request(app.getHttpServer())
      .post('/api/me/game-manage/world-cups')
      .set('access-token', 'valid-token')
      .send({
        title: '  새 월드컵  ',
        description: '  새 설명  ',
        visibleType: 'PUBLIC',
      })
      .expect(201)
      .expect({ code: 1, message: '게임 생성', data: 11 });

    expect(manageWorldCupsService.create).toHaveBeenCalledWith(7, {
      title: '새 월드컵',
      description: '새 설명',
      visibleType: 'PUBLIC',
    });
  });

  it('rejects an invalid visibility before creating a world cup', async () => {
    await request(app.getHttpServer())
      .post('/api/me/game-manage/world-cups')
      .set('access-token', 'valid-token')
      .send({ title: '새 월드컵', visibleType: 'OPEN' })
      .expect(400);

    expect(manageWorldCupsService.create).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await app.close();
  });
});
