import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app.js';

describe('IWTC API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.example.com/iwtc';
    process.env.JWT_ACCESS_SECRET =
      'test-access-secret-with-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-with-at-least-32-characters';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.JWT_REFRESH_TTL_SECONDS = '2592000';

    const { AppModule } = await import('../src/app.module.js');
    const { AuthService } = await import('../src/auth/auth.service.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');

    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn().mockResolvedValue({
      id: 1,
      title: '첫 번째 월드컵',
      description: '설명',
      _count: { candidates: 4 },
    });
    const candidates = [
      { id: 1, name: '후보 A', mediaFileId: null },
      { id: 2, name: '후보 B', mediaFileId: null },
      { id: 3, name: '후보 C', mediaFileId: null },
      { id: 4, name: '후보 D', mediaFileId: null },
    ];
    const findCandidates = vi
      .fn()
      .mockImplementation(
        (arguments_: { where?: { id?: { in?: number[] } } }) => {
          const requestedIds = arguments_.where?.id?.in;
          return Promise.resolve(
            requestedIds
              ? candidates.filter((candidate) =>
                  requestedIds.includes(candidate.id),
                )
              : candidates,
          );
        },
      );
    const findCandidate = vi
      .fn()
      .mockImplementation(
        ({ where }: { where: { id: number; worldCupId: number } }) =>
          Promise.resolve(
            where.worldCupId === 1
              ? (candidates.find((candidate) => candidate.id === where.id) ??
                  null)
              : null,
          ),
      );
    type StoredPlay = {
      id: string;
      worldCupId: number;
      initialRound: number;
      placements: Array<{
        rank: number;
        score: number;
        candidate: (typeof candidates)[number];
      }>;
    };
    const storedPlays = new Map<string, StoredPlay>();
    const gamePlay = {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(storedPlays.get(where.id) ?? null),
        ),
      create: vi.fn().mockImplementation(
        ({
          data,
        }: {
          data: {
            id: string;
            worldCupId: number;
            initialRound: number;
            placements: {
              create: Array<{
                candidateId: number;
                rank: number;
                score: number;
              }>;
            };
          };
        }) => {
          if (storedPlays.has(data.id)) {
            return Promise.reject({ code: 'P2002' });
          }

          const play: StoredPlay = {
            id: data.id,
            worldCupId: data.worldCupId,
            initialRound: data.initialRound,
            placements: data.placements.create.map((placement) => ({
              rank: placement.rank,
              score: placement.score,
              candidate: candidates.find(
                (candidate) => candidate.id === placement.candidateId,
              )!,
            })),
          };
          storedPlays.set(play.id, play);
          return Promise.resolve(play);
        },
      ),
    };
    const gamePlacement = {
      groupBy: vi.fn().mockImplementation(() => {
        const scores = new Map<number, number>();
        for (const play of storedPlays.values()) {
          for (const placement of play.placements) {
            scores.set(
              placement.candidate.id,
              (scores.get(placement.candidate.id) ?? 0) + placement.score,
            );
          }
        }
        return Promise.resolve(
          [...scores].map(([candidateId, score]) => ({
            candidateId,
            _sum: { score },
          })),
        );
      }),
    };
    const transactionClient = {
      worldCup: { findFirst },
      candidate: { findMany: findCandidates },
      gamePlay,
    };
    const mediaFiles = [
      {
        id: 10,
        fileType: 'STATIC_MEDIA_FILE',
        detailType: 'PNG',
        objectKey: 'original/candidate A.png',
        thumbnailObjectKey: 'divide2/candidate A.png',
        externalUrl: null,
        originalName: 'candidate A.png',
        videoStartTime: null,
        videoPlayDuration: null,
        createdAt: new Date('2026-09-07T00:00:00.000Z'),
        updatedAt: new Date('2026-09-07T01:00:00.000Z'),
      },
    ];
    const mediaFile = {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: number } }) =>
          Promise.resolve(
            mediaFiles.find((item) => item.id === where.id) ?? null,
          ),
        ),
    };
    const storedComments: Array<{
      id: number;
      worldCupId: number;
      candidateId: number;
      memberId: number | null;
      nickname: string;
      body: string;
      deletedAt: Date | null;
      createdAt: Date;
    }> = [];
    const comment = {
      findMany: vi
        .fn()
        .mockImplementation(
          ({
            where,
            skip,
            take,
          }: {
            where: { worldCupId: number; deletedAt: null };
            skip: number;
            take: number;
          }) =>
            Promise.resolve(
              storedComments
                .filter(
                  (item) =>
                    item.worldCupId === where.worldCupId &&
                    item.deletedAt === where.deletedAt,
                )
                .sort(
                  (left, right) =>
                    right.createdAt.getTime() - left.createdAt.getTime() ||
                    right.id - left.id,
                )
                .slice(skip, skip + take),
            ),
        ),
      findFirst: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: number; deletedAt: null } }) =>
            Promise.resolve(
              storedComments.find(
                (item) =>
                  item.id === where.id && item.deletedAt === where.deletedAt,
              ) ?? null,
            ),
        ),
      create: vi.fn().mockImplementation(
        ({
          data,
        }: {
          data: {
            worldCupId: number;
            candidateId: number;
            memberId: number | null;
            nickname: string;
            body: string;
          };
        }) => {
          const created = {
            id: storedComments.length + 1,
            ...data,
            deletedAt: null,
            createdAt: new Date('2026-09-08T00:00:00.000Z'),
          };
          storedComments.push(created);
          return Promise.resolve(created);
        },
      ),
      updateMany: vi
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: number; memberId: number; deletedAt: null };
            data: { deletedAt: Date };
          }) => {
            const storedComment = storedComments.find(
              (item) =>
                item.id === where.id &&
                item.memberId === where.memberId &&
                item.deletedAt === where.deletedAt,
            );
            if (!storedComment) {
              return Promise.resolve({ count: 0 });
            }
            storedComment.deletedAt = data.deletedAt;
            return Promise.resolve({ count: 1 });
          },
        ),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        worldCup: { count, findMany, findFirst },
        candidate: { findMany: findCandidates, findFirst: findCandidate },
        gamePlay,
        gamePlacement,
        mediaFile,
        comment,
        $transaction: (
          operation:
            | Promise<unknown>[]
            | ((client: typeof transactionClient) => Promise<unknown>),
        ) =>
          Array.isArray(operation)
            ? Promise.all(operation)
            : operation(transactionClient),
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .overrideProvider(AuthService)
      .useValue({
        authorizeAccess: vi.fn().mockImplementation((token: string) => {
          if (
            token !== 'valid-member-token' &&
            token !== 'valid-other-member-token'
          ) {
            return Promise.reject(
              new UnauthorizedException(
                '로그인이 만료되었습니다. 다시 로그인해주세요.',
              ),
            );
          }
          return Promise.resolve({
            id: token === 'valid-member-token' ? 7 : 8,
            serviceId: token === 'valid-member-token' ? 'member07' : 'member08',
            nickname:
              token === 'valid-member-token' ? '회원닉네임' : '다른회원',
          });
        }),
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

  it('POST /api/world-cups/1/clear saves a game result', async () => {
    await request(app.getHttpServer())
      .post('/api/world-cups/1/clear')
      .send({
        playId: '550e8400-e29b-41d4-a716-446655440000',
        round: 4,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
          { contentsId: 3, rank: 3 },
          { contentsId: 4, rank: 4 },
        ],
      })
      .expect(201)
      .expect({
        code: 1,
        message: '게임 결과 생성',
        data: [
          { contentsName: '후보 A', contentsId: 1, mediaFileId: null, rank: 1 },
          { contentsName: '후보 B', contentsId: 2, mediaFileId: null, rank: 2 },
          { contentsName: '후보 C', contentsId: 3, mediaFileId: null, rank: 3 },
          { contentsName: '후보 D', contentsId: 4, mediaFileId: null, rank: 4 },
        ],
      });
  });

  it('returns the original result for an identical retry', async () => {
    await request(app.getHttpServer())
      .post('/api/world-cups/1/clear')
      .send({
        playId: '550e8400-e29b-41d4-a716-446655440000',
        round: 4,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
          { contentsId: 3, rank: 3 },
          { contentsId: 4, rank: 4 },
        ],
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toHaveLength(4);
        expect(response.body.data[0]).toMatchObject({
          contentsId: 1,
          rank: 1,
        });
      });
  });

  it('rejects reuse of a play id with a different result', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/clear')
      .send({
        playId: '550e8400-e29b-41d4-a716-446655440000',
        round: 4,
        placements: [
          { contentsId: 2, rank: 1 },
          { contentsId: 1, rank: 2 },
          { contentsId: 3, rank: 3 },
          { contentsId: 4, rank: 4 },
        ],
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: -1,
      message: '이미 다른 결과에 사용된 playId입니다.',
      data: null,
    });
  });

  it('rejects an invalid clear request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/clear')
      .send({
        playId: 'not-a-uuid',
        round: 2,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 1, rank: 2 },
        ],
      })
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  it('GET /api/world-cups/1/game-result-contents returns accumulated rankings', async () => {
    await request(app.getHttpServer())
      .get('/api/world-cups/1/game-result-contents')
      .expect(200)
      .expect({
        code: 1,
        message: '게임 결과 컨텐츠 리스트 조회 성공',
        data: [
          {
            contentsId: 1,
            contentsName: '후보 A',
            mediaFileId: null,
            gameRank: 1,
            gameScore: 10,
          },
          {
            contentsId: 2,
            contentsName: '후보 B',
            mediaFileId: null,
            gameRank: 2,
            gameScore: 7,
          },
          {
            contentsId: 3,
            contentsName: '후보 C',
            mediaFileId: null,
            gameRank: 3,
            gameScore: 4,
          },
          {
            contentsId: 4,
            contentsName: '후보 D',
            mediaFileId: null,
            gameRank: 3,
            gameScore: 4,
          },
        ],
      });
  });

  it('GET /api/world-cups/1/comments returns an empty guest comment list', async () => {
    await request(app.getHttpServer())
      .get('/api/world-cups/1/comments?offset=0')
      .expect(200)
      .expect({
        code: 1,
        message: '코멘트 조회 성공',
        data: [],
      });
  });

  it('POST /api/world-cups/1/contents/1/comments creates a guest comment', async () => {
    await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .send({ body: '재미있는 월드컵이에요!', nickname: 'guest-a1' })
      .expect(201)
      .expect({ code: 1, message: '댓글 작성', data: null });

    await request(app.getHttpServer())
      .get('/api/world-cups/1/comments?offset=0&limit=20')
      .expect(200)
      .expect({
        code: 1,
        message: '코멘트 조회 성공',
        data: [
          {
            commentId: 1,
            commentWriterId: null,
            writerNickname: 'guest-a1',
            body: '재미있는 월드컵이에요!',
            createdAt: '2026-09-08T00:00:00.000Z',
          },
        ],
      });
  });

  it('creates a member comment without trusting a request nickname', async () => {
    await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .set('access-token', 'valid-member-token')
      .send({ body: '회원 댓글', nickname: '위조닉네임' })
      .expect(201)
      .expect({ code: 1, message: '댓글 작성', data: null });

    const response = await request(app.getHttpServer())
      .get('/api/world-cups/1/comments?offset=0&limit=20')
      .expect(200);

    expect(response.body.data[0]).toMatchObject({
      commentId: 2,
      commentWriterId: 7,
      writerNickname: '회원닉네임',
      body: '회원 댓글',
    });
  });

  it('allows an authenticated member to omit the nickname', async () => {
    await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .set('access-token', 'valid-member-token')
      .send({ body: '닉네임 생략 회원 댓글' })
      .expect(201);
  });

  it('DELETE /api/comments/:id soft-deletes an owned member comment', async () => {
    await request(app.getHttpServer())
      .delete('/api/comments/2')
      .set('access-token', 'valid-member-token')
      .expect(204)
      .expect('');

    const response = await request(app.getHttpServer())
      .get('/api/world-cups/1/comments?offset=0&limit=20')
      .expect(200);

    expect(response.body.data).not.toContainEqual(
      expect.objectContaining({ commentId: 2 }),
    );
  });

  it('rejects deletion without authentication', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/comments/3')
      .expect(401);

    expect(response.body).toMatchObject({
      code: -1,
      message: '로그인이 필요합니다.',
      data: null,
    });
  });

  it('rejects deletion by a different member', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/comments/3')
      .set('access-token', 'valid-other-member-token')
      .expect(403);

    expect(response.body).toMatchObject({
      code: -1,
      message: '댓글 작성자만 삭제할 수 있습니다.',
      data: null,
    });
  });

  it('rejects deletion of a guest comment', async () => {
    await request(app.getHttpServer())
      .delete('/api/comments/1')
      .set('access-token', 'valid-member-token')
      .expect(403);
  });

  it('returns not found when deleting an already deleted comment', async () => {
    await request(app.getHttpServer())
      .delete('/api/comments/2')
      .set('access-token', 'valid-member-token')
      .expect(404);
  });

  it('rejects an invalid token instead of treating it as a guest', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .set('access-token', 'invalid-member-token')
      .send({ body: '잘못된 토큰 댓글', nickname: 'guest-a1' })
      .expect(401);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  it('rejects an empty guest comment', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .send({ body: '   ', nickname: 'guest-a1' })
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  it('requires a nickname only for a guest comment', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/1/comments')
      .send({ body: '닉네임 없는 비회원 댓글' })
      .expect(400);

    expect(response.body).toMatchObject({
      code: -1,
      message: '비회원 댓글은 닉네임이 필요합니다.',
      data: null,
    });
  });

  it('rejects a comment for a candidate outside the world cup', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/world-cups/1/contents/999/comments')
      .send({ body: '댓글', nickname: 'guest-a1' })
      .expect(404);

    expect(response.body).toMatchObject({
      code: -1,
      message: '월드컵 후보를 찾을 수 없습니다.',
      data: null,
    });
  });

  it('GET /api/media-files/10 returns the requested thumbnail URL', async () => {
    await request(app.getHttpServer())
      .get('/api/media-files/10?size=divide2')
      .expect('Cache-Control', 'public, no-cache')
      .expect(200)
      .expect({
        code: 1,
        message: '미디어 파일 조회',
        data: {
          mediaFileId: 10,
          fileType: 'STATIC_MEDIA_FILE',
          mediaData: 'https://media.example.com/iwtc/divide2/candidate%20A.png',
          originalName: 'candidate A.png',
          videoStartTime: null,
          videoPlayDuration: null,
          detailType: 'PNG',
          createdAt: '2026-09-07T00:00:00.000Z',
          updatedAt: '2026-09-07T01:00:00.000Z',
        },
      });
  });

  it('rejects an unsupported media size', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/media-files/10?size=small')
      .expect(400);

    expect(response.body).toMatchObject({ code: -1, data: null });
  });

  it('returns 404 for an unknown media file', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/media-files/999')
      .expect(404);

    expect(response.body).toMatchObject({
      code: -1,
      message: '미디어 파일을 찾을 수 없습니다.',
      data: null,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
