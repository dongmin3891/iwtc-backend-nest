import type { PrismaService } from '../prisma/prisma.service.js';
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
      }),
    );
  });

  it('returns supported rounds that fit the public candidate count', async () => {
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
    const findMany = vi.fn().mockResolvedValue(candidates);
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
        where: expect.objectContaining({ id: { notIn: [2, 4] } }),
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
});
