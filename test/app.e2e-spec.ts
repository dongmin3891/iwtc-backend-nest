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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        worldCup: { count, findMany },
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

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
