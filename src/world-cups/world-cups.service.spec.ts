import type { PrismaService } from '../prisma/prisma.service.js';
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
});
