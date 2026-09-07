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
});
