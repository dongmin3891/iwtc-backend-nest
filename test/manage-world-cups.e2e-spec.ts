import { NotFoundException, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureApp } from '../src/configure-app.js';
import { ManageWorldCupContentsController } from '../src/manage-world-cups/manage-world-cup-contents.controller.js';
import { ManageWorldCupContentsService } from '../src/manage-world-cups/manage-world-cup-contents.service.js';
import { ManageWorldCupsController } from '../src/manage-world-cups/manage-world-cups.controller.js';
import { ManageWorldCupsService } from '../src/manage-world-cups/manage-world-cups.service.js';

function createContentsRequest(): object {
  return {
    data: [
      {
        contentsName: '  후보 A  ',
        visibleType: 'PRIVATE',
        createMediaFileRequest: {
          fileType: 'INTERNET_VIDEO_URL',
          mediaData: '  https://www.youtube.com/watch?v=video-a  ',
          originalName: '  ignored-name  ',
          videoStartTime: '  00030  ',
          videoPlayDuration: 3,
          detailFileType: 'YOU_TUBE_URL',
        },
      },
      {
        contentsName: '후보 B',
        visibleType: 'PUBLIC',
        createMediaFileRequest: {
          fileType: 'INTERNET_VIDEO_URL',
          mediaData: 'https://www.youtube.com/watch?v=video-b',
          videoStartTime: '00045',
          videoPlayDuration: 5,
          detailFileType: 'YOU_TUBE_URL',
        },
      },
    ],
  };
}

function updateContentsRequest(): object {
  return {
    contentsName: '  수정 후보  ',
    originalName: '  ignored-name  ',
    mediaData: '  https://www.youtube.com/watch?v=updated-video  ',
    detailFileType: 'YOU_TUBE_URL',
    videoStartTime: '  00120  ',
    videoPlayDuration: '5',
    visibleType: 'PUBLIC',
  };
}

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
  const manageWorldCupContentsService = {
    createMany: vi.fn().mockResolvedValue([51, 52]),
    updateOne: vi.fn().mockResolvedValue(31),
    findAll: vi.fn().mockResolvedValue([
      {
        contentsId: 31,
        contentsName: '후보 A',
        mediaFileId: 41,
        visibleType: 'PUBLIC',
        gameRank: 1,
        gameScore: 100,
      },
    ]),
  };

  beforeAll(async () => {
    const config = new ConfigService({
      CORS_ORIGINS: ['http://localhost:3000'],
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        ManageWorldCupsController,
        ManageWorldCupContentsController,
      ],
      providers: [
        AccessTokenGuard,
        { provide: AuthService, useValue: authService },
        {
          provide: ManageWorldCupsService,
          useValue: manageWorldCupsService,
        },
        {
          provide: ManageWorldCupContentsService,
          useValue: manageWorldCupContentsService,
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

  it('returns management contents for an owned world cup', async () => {
    await request(app.getHttpServer())
      .get('/api/me/game-contents-manage/world-cups/3/manage-contents')
      .set('access-token', 'valid-token')
      .expect(200)
      .expect({
        code: 1,
        message: '자신의 게임 컨텐츠 리스트 조회',
        data: [
          {
            contentsId: 31,
            contentsName: '후보 A',
            mediaFileId: 41,
            visibleType: 'PUBLIC',
            gameRank: 1,
            gameScore: 100,
          },
        ],
      });

    expect(manageWorldCupContentsService.findAll).toHaveBeenCalledWith(7, 3);
  });

  it('requires authentication for management contents', async () => {
    await request(app.getHttpServer())
      .get('/api/me/game-contents-manage/world-cups/3/manage-contents')
      .expect(401);

    expect(manageWorldCupContentsService.findAll).not.toHaveBeenCalled();
  });

  it('creates validated candidates for an owned world cup', async () => {
    await request(app.getHttpServer())
      .post('/api/me/game-contents-manage/world-cups/3/contents')
      .set('access-token', 'valid-token')
      .send(createContentsRequest())
      .expect(201)
      .expect({ code: 1, message: '게임 생성', data: null });

    expect(manageWorldCupContentsService.createMany).toHaveBeenCalledWith(
      7,
      3,
      [
        {
          contentsName: '후보 A',
          visibleType: 'PRIVATE',
          createMediaFileRequest: {
            fileType: 'INTERNET_VIDEO_URL',
            mediaData: 'https://www.youtube.com/watch?v=video-a',
            originalName: 'ignored-name',
            videoStartTime: '00030',
            videoPlayDuration: 3,
            detailFileType: 'YOU_TUBE_URL',
          },
        },
        {
          contentsName: '후보 B',
          visibleType: 'PUBLIC',
          createMediaFileRequest: {
            fileType: 'INTERNET_VIDEO_URL',
            mediaData: 'https://www.youtube.com/watch?v=video-b',
            videoStartTime: '00045',
            videoPlayDuration: 5,
            detailFileType: 'YOU_TUBE_URL',
          },
        },
      ],
    );
  });

  it('requires authentication before creating candidates', async () => {
    await request(app.getHttpServer())
      .post('/api/me/game-contents-manage/world-cups/3/contents')
      .send(createContentsRequest())
      .expect(401)
      .expect({ code: -1, message: '로그인이 필요합니다.', data: null });

    expect(manageWorldCupContentsService.createMany).not.toHaveBeenCalled();
  });

  it('rejects invalid candidates before calling the storage service', async () => {
    await request(app.getHttpServer())
      .post('/api/me/game-contents-manage/world-cups/3/contents')
      .set('access-token', 'valid-token')
      .send({ data: [] })
      .expect(400);

    expect(manageWorldCupContentsService.createMany).not.toHaveBeenCalled();
  });

  it('does not reveal another member world cup while creating candidates', async () => {
    manageWorldCupContentsService.createMany.mockRejectedValueOnce(
      new NotFoundException('월드컵을 찾을 수 없습니다.'),
    );

    await request(app.getHttpServer())
      .post('/api/me/game-contents-manage/world-cups/99/contents')
      .set('access-token', 'valid-token')
      .send(createContentsRequest())
      .expect(404)
      .expect({
        code: -1,
        message: '월드컵을 찾을 수 없습니다.',
        data: null,
      });

    expect(manageWorldCupContentsService.createMany).toHaveBeenCalledWith(
      7,
      99,
      expect.any(Array),
    );
  });

  it('updates a validated candidate for an owned world cup', async () => {
    await request(app.getHttpServer())
      .put('/api/me/game-contents-manage/world-cups/3/contents/31')
      .set('access-token', 'valid-token')
      .send(updateContentsRequest())
      .expect(204);

    expect(manageWorldCupContentsService.updateOne).toHaveBeenCalledWith(
      7,
      3,
      31,
      {
        contentsName: '수정 후보',
        originalName: 'ignored-name',
        mediaData: 'https://www.youtube.com/watch?v=updated-video',
        detailFileType: 'YOU_TUBE_URL',
        videoStartTime: '00120',
        videoPlayDuration: 5,
        visibleType: 'PUBLIC',
      },
    );
  });

  it('requires authentication before updating a candidate', async () => {
    await request(app.getHttpServer())
      .put('/api/me/game-contents-manage/world-cups/3/contents/31')
      .send(updateContentsRequest())
      .expect(401)
      .expect({ code: -1, message: '로그인이 필요합니다.', data: null });

    expect(manageWorldCupContentsService.updateOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid candidate update before calling the service', async () => {
    await request(app.getHttpServer())
      .put('/api/me/game-contents-manage/world-cups/3/contents/31')
      .set('access-token', 'valid-token')
      .send({
        ...updateContentsRequest(),
        mediaData: 'https://example.com/video',
        detailFileType: 'PNG',
      })
      .expect(400);

    expect(manageWorldCupContentsService.updateOne).not.toHaveBeenCalled();
  });

  it('does not reveal another member world cup while updating a candidate', async () => {
    manageWorldCupContentsService.updateOne.mockRejectedValueOnce(
      new NotFoundException('월드컵을 찾을 수 없습니다.'),
    );

    await request(app.getHttpServer())
      .put('/api/me/game-contents-manage/world-cups/99/contents/31')
      .set('access-token', 'valid-token')
      .send(updateContentsRequest())
      .expect(404)
      .expect({
        code: -1,
        message: '월드컵을 찾을 수 없습니다.',
        data: null,
      });

    expect(manageWorldCupContentsService.updateOne).toHaveBeenCalledWith(
      7,
      99,
      31,
      expect.any(Object),
    );
  });

  it('returns not found for a missing candidate', async () => {
    manageWorldCupContentsService.updateOne.mockRejectedValueOnce(
      new NotFoundException('월드컵 후보를 찾을 수 없습니다.'),
    );

    await request(app.getHttpServer())
      .put('/api/me/game-contents-manage/world-cups/3/contents/999')
      .set('access-token', 'valid-token')
      .send(updateContentsRequest())
      .expect(404)
      .expect({
        code: -1,
        message: '월드컵 후보를 찾을 수 없습니다.',
        data: null,
      });

    expect(manageWorldCupContentsService.updateOne).toHaveBeenCalledWith(
      7,
      3,
      999,
      expect.any(Object),
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
