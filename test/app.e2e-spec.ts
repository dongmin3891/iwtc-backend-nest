import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app.js';

describe('IWTC API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const { AppModule } = await import('../src/app.module.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');

    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn().mockResolvedValue({
      id: 1,
      title: '첫 번째 월드컵',
      description: '설명',
      _count: { candidates: 4 },
    });
    const findCandidates = vi.fn().mockResolvedValue([
      { id: 1, name: '후보 A', mediaFileId: null },
      { id: 2, name: '후보 B', mediaFileId: null },
      { id: 3, name: '후보 C', mediaFileId: null },
      { id: 4, name: '후보 D', mediaFileId: null },
    ]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        worldCup: { count, findMany, findFirst },
        candidate: { findMany: findCandidates },
        $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /health/live', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /api/world-cups returns an empty first page', async () => {
    await request(app.getHttpServer())
      .get('/api/world-cups')
      .expect(200)
      .expect({
        code: 1,
        message: '월드컵 페이지 조회 성공',
        data: {
          totalElements: 0,
          content: [],
          pageable: {
            pageNumber: 0,
            pageSize: 20,
          },
          totalPages: 0,
        },
      });
  });

  it('rejects an unsupported sort field', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/world-cups?sort=title,DESC')
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  it('GET /api/world-cups/1/available-rounds returns 2 and 4', async () => {
    await request(app.getHttpServer())
      .get('/api/world-cups/1/available-rounds')
      .expect(200)
      .expect({
        code: 1,
        message: '플레이 가능한 라운드 조회 성공',
        data: {
          worldCupId: 1,
          worldCupTitle: '첫 번째 월드컵',
          worldCupDescription: '설명',
          rounds: [2, 4],
        },
      });
  });

  it('GET /api/world-cups/1/contents returns four game candidates', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/world-cups/1/contents?currentRound=4&sliceContents=1')
      .expect(200);

    expect(response.body).toMatchObject({
      code: 1,
      message: '컨텐츠 조회 성공',
      data: {
        worldCupId: 1,
        title: '첫 번째 월드컵',
        round: 4,
      },
    });
    expect(response.body.data.contentsList).toHaveLength(4);
    expect(
      response.body.data.contentsList
        .map(({ contentsId }: { contentsId: number }) => contentsId)
        .sort(),
    ).toEqual([1, 2, 3, 4]);
  });

  it('rejects an unsupported contents round', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/world-cups/1/contents?currentRound=3&sliceContents=1')
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
