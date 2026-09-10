import type { PrismaService } from '../prisma/prisma.service.js';
import { ClearWorldCupDto } from './dto/clear-world-cup.dto.js';
import { GetWorldCupContentsQuery } from './dto/get-world-cup-contents.query.js';
import { DateRange, ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import { WorldCupsService } from './world-cups.service.js';

describe('WorldCupsService', () => {
  it('returns an empty page for a fresh database', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      worldCup: { count, findMany },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const query = new ListWorldCupsQuery();
    query.dateRange = DateRange.ALL;

    await expect(service.findAll(query)).resolves.toEqual({
      totalElements: 0,
      content: [],
      pageable: { pageNumber: 0, pageSize: 20 },
      totalPages: 0,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'desc' },
        skip: 0,
        take: 20,
        include: {
          candidates: expect.objectContaining({
            where: { visibleType: 'PUBLIC', deletedAt: null },
          }),
        },
      }),
    );
  });

  it('returns supported rounds that fit the active public candidate count', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 1,
      title: '첫 번째 월드컵',
      description: '설명',
      _count: { candidates: 4 },
    });
    const prisma = {
      worldCup: { findFirst },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);

    await expect(service.findAvailableRounds(1)).resolves.toEqual({
      worldCupId: 1,
      worldCupTitle: '첫 번째 월드컵',
      worldCupDescription: '설명',
      rounds: [2, 4],
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              candidates: {
                where: { visibleType: 'PUBLIC', deletedAt: null },
              },
            },
          },
        }),
      }),
    );
  });

  it('rejects an unknown world cup', async () => {
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);

    await expect(service.findAvailableRounds(999)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns all candidates needed for the requested round', async () => {
    const candidates = [
      { id: 1, name: '후보 A', mediaFileId: null },
      { id: 2, name: '후보 B', mediaFileId: null },
      { id: 3, name: '후보 C', mediaFileId: null },
      { id: 4, name: '후보 D', mediaFileId: null },
    ];
    const findFirst = vi.fn().mockResolvedValue({
      id: 1,
      title: '첫 번째 월드컵',
      _count: { candidates: 4 },
    });
    const findMany = vi.fn().mockResolvedValue(candidates);
    const prisma = {
      worldCup: {
        findFirst,
      },
      candidate: { findMany },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const query = new GetWorldCupContentsQuery();
    query.currentRound = 4;
    query.sliceContents = 1;

    const result = await service.findContents(1, query);

    expect(result).toMatchObject({
      worldCupId: 1,
      title: '첫 번째 월드컵',
      round: 4,
    });
    expect(result.contentsList).toHaveLength(4);
    expect(
      result.contentsList.map(({ contentsId }) => contentsId).sort(),
    ).toEqual([1, 2, 3, 4]);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              candidates: {
                where: { visibleType: 'PUBLIC', deletedAt: null },
              },
            },
          },
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          worldCupId: 1,
          visibleType: 'PUBLIC',
          deletedAt: null,
        },
      }),
    );
  });

  it('excludes eliminated candidates when loading the next round', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, name: '후보 A', mediaFileId: null },
      { id: 3, name: '후보 C', mediaFileId: null },
    ]);
    const prisma = {
      worldCup: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          title: '첫 번째 월드컵',
          _count: { candidates: 4 },
        }),
      },
      candidate: { findMany },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const query = new GetWorldCupContentsQuery();
    query.currentRound = 2;
    query.sliceContents = 1;
    query.excludeContentsIds = [2, 4];

    const result = await service.findContents(1, query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          id: { notIn: [2, 4] },
        }),
      }),
    );
    expect(
      result.contentsList.map(({ contentsId }) => contentsId).sort(),
    ).toEqual([1, 3]);
  });

  it('rejects a round larger than the public candidate count', async () => {
    const prisma = {
      worldCup: {
        findFirst: vi.fn().mockResolvedValue({
          id: 1,
          title: '첫 번째 월드컵',
          _count: { candidates: 4 },
        }),
      },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const query = new GetWorldCupContentsQuery();
    query.currentRound = 8;
    query.sliceContents = 1;

    await expect(service.findContents(1, query)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('saves the game and its placements in one transaction', async () => {
    const create = vi.fn().mockResolvedValue({
      placements: [
        {
          rank: 1,
          candidate: { id: 1, name: '후보 A', mediaFileId: 11 },
        },
        {
          rank: 2,
          candidate: { id: 2, name: '후보 B', mediaFileId: 12 },
        },
        {
          rank: 3,
          candidate: { id: 3, name: '후보 C', mediaFileId: null },
        },
        {
          rank: 4,
          candidate: { id: 4, name: '후보 D', mediaFileId: 14 },
        },
      ],
    });
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]),
      },
      gamePlay: { findUnique: vi.fn().mockResolvedValue(null), create },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(
          (operation: (client: typeof transaction) => unknown) =>
            operation(transaction),
        ),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: '550e8400-e29b-41d4-a716-446655440000',
      round: 4,
      placements: [
        { contentsId: 1, rank: 1 },
        { contentsId: 2, rank: 2 },
        { contentsId: 3, rank: 3 },
        { contentsId: 4, rank: 4 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(1, request)).resolves.toEqual([
      { contentsName: '후보 A', contentsId: 1, mediaFileId: 11, rank: 1 },
      { contentsName: '후보 B', contentsId: 2, mediaFileId: 12, rank: 2 },
      { contentsName: '후보 C', contentsId: 3, mediaFileId: null, rank: 3 },
      { contentsName: '후보 D', contentsId: 4, mediaFileId: 14, rank: 4 },
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: request.playId,
          worldCupId: 1,
          initialRound: 4,
          placements: {
            create: [
              { candidateId: 1, rank: 1, score: 10 },
              { candidateId: 2, rank: 2, score: 7 },
              { candidateId: 3, rank: 3, score: 4 },
              { candidateId: 4, rank: 4, score: 4 },
            ],
          },
        }),
      }),
    );
    expect(transaction.candidate.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2, 3, 4] },
        worldCupId: 1,
        visibleType: 'PUBLIC',
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('rejects game results for an unknown world cup', async () => {
    const create = vi.fn();
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      candidate: { findMany: vi.fn() },
      gamePlay: { findUnique: vi.fn().mockResolvedValue(null), create },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(
          (operation: (client: typeof transaction) => unknown) =>
            operation(transaction),
        ),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: '550e8400-e29b-41d4-a716-446655440000',
      round: 2,
      placements: [
        { contentsId: 1, rank: 1 },
        { contentsId: 2, rank: 2 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(999, request)).rejects.toMatchObject({
      status: 404,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects candidates that do not belong to the world cup', async () => {
    const create = vi.fn();
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      gamePlay: { findUnique: vi.fn().mockResolvedValue(null), create },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(
          (operation: (client: typeof transaction) => unknown) =>
            operation(transaction),
        ),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: '550e8400-e29b-41d4-a716-446655440000',
      round: 2,
      placements: [
        { contentsId: 1, rank: 1 },
        { contentsId: 20, rank: 2 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(1, request)).rejects.toMatchObject({
      status: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the saved result without revalidating candidates', async () => {
    const existingPlay = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      worldCupId: 1,
      initialRound: 2,
      placements: [
        {
          rank: 1,
          candidate: { id: 1, name: '후보 A', mediaFileId: 11 },
        },
        {
          rank: 2,
          candidate: { id: 2, name: '후보 B', mediaFileId: 12 },
        },
      ],
    };
    const create = vi.fn();
    const transaction = {
      gamePlay: { findUnique: vi.fn().mockResolvedValue(existingPlay), create },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(
          (operation: (client: typeof transaction) => unknown) =>
            operation(transaction),
        ),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: existingPlay.id,
      round: 2,
      placements: [
        { contentsId: 1, rank: 1 },
        { contentsId: 2, rank: 2 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(1, request)).resolves.toEqual([
      { contentsName: '후보 A', contentsId: 1, mediaFileId: 11, rank: 1 },
      { contentsName: '후보 B', contentsId: 2, mediaFileId: 12, rank: 2 },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a play id with a different result', async () => {
    const existingPlay = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      worldCupId: 1,
      initialRound: 2,
      placements: [
        {
          rank: 1,
          candidate: { id: 1, name: '후보 A', mediaFileId: 11 },
        },
        {
          rank: 2,
          candidate: { id: 2, name: '후보 B', mediaFileId: 12 },
        },
      ],
    };
    const transaction = {
      gamePlay: {
        findUnique: vi.fn().mockResolvedValue(existingPlay),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(
          (operation: (client: typeof transaction) => unknown) =>
            operation(transaction),
        ),
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: existingPlay.id,
      round: 2,
      placements: [
        { contentsId: 2, rank: 1 },
        { contentsId: 1, rank: 2 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(1, request)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('recovers an identical concurrent submission after a unique conflict', async () => {
    const existingPlay = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      worldCupId: 1,
      initialRound: 2,
      placements: [
        {
          rank: 1,
          candidate: { id: 1, name: '후보 A', mediaFileId: 11 },
        },
        {
          rank: 2,
          candidate: { id: 2, name: '후보 B', mediaFileId: 12 },
        },
      ],
    };
    const prisma = {
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' }),
      gamePlay: { findUnique: vi.fn().mockResolvedValue(existingPlay) },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);
    const request = {
      playId: existingPlay.id,
      round: 2,
      placements: [
        { contentsId: 1, rank: 1 },
        { contentsId: 2, rank: 2 },
      ],
    } as ClearWorldCupDto;

    await expect(service.saveGameResult(1, request)).resolves.toHaveLength(2);
  });

  it('ranks active public candidates by accumulated score and includes zero scores', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 1, name: '후보 A', mediaFileId: 11 },
      { id: 2, name: '후보 B', mediaFileId: 12 },
      { id: 3, name: '후보 C', mediaFileId: null },
      { id: 4, name: '후보 D', mediaFileId: 14 },
    ]);
    const groupBy = vi.fn().mockResolvedValue([
      { candidateId: 1, _sum: { score: 20 } },
      { candidateId: 2, _sum: { score: 7 } },
      { candidateId: 3, _sum: { score: 7 } },
    ]);
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findMany },
      gamePlacement: { groupBy },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);

    await expect(service.findGameResultContents(1)).resolves.toEqual([
      {
        contentsId: 1,
        contentsName: '후보 A',
        mediaFileId: 11,
        gameRank: 1,
        gameScore: 20,
      },
      {
        contentsId: 2,
        contentsName: '후보 B',
        mediaFileId: 12,
        gameRank: 2,
        gameScore: 7,
      },
      {
        contentsId: 3,
        contentsName: '후보 C',
        mediaFileId: null,
        gameRank: 2,
        gameScore: 7,
      },
      {
        contentsId: 4,
        contentsName: '후보 D',
        mediaFileId: 14,
        gameRank: 4,
        gameScore: 0,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        worldCupId: 1,
        visibleType: 'PUBLIC',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        mediaFileId: true,
      },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['candidateId'],
      where: { candidateId: { in: [1, 2, 3, 4] } },
      _sum: { score: true },
    });
  });

  it('rejects ranking requests for an unknown world cup', async () => {
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new WorldCupsService(prisma);

    await expect(service.findGameResultContents(999)).rejects.toMatchObject({
      status: 404,
    });
  });
});
