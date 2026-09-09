import type { PrismaService } from '../prisma/prisma.service.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';

describe('ManageWorldCupContentsService', () => {
  it('returns owned contents in management order with derived scores and ranks', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 3 });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 11,
        name: '후보 A',
        mediaFileId: 21,
        visibleType: 'PUBLIC',
      },
      {
        id: 12,
        name: '후보 B',
        mediaFileId: null,
        visibleType: 'PRIVATE',
      },
      {
        id: 13,
        name: '후보 C',
        mediaFileId: 23,
        visibleType: 'PUBLIC',
      },
    ]);
    const groupBy = vi.fn().mockResolvedValue([
      { candidateId: 11, _sum: { score: 10 } },
      { candidateId: 12, _sum: { score: 20 } },
      { candidateId: 13, _sum: { score: 10 } },
    ]);
    const prisma = {
      worldCup: { findFirst },
      candidate: { findMany },
      gamePlacement: { groupBy },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.findAll(7, 3)).resolves.toEqual([
      {
        contentsId: 11,
        contentsName: '후보 A',
        mediaFileId: 21,
        visibleType: 'PUBLIC',
        gameRank: 2,
        gameScore: 10,
      },
      {
        contentsId: 12,
        contentsName: '후보 B',
        mediaFileId: null,
        visibleType: 'PRIVATE',
        gameRank: 1,
        gameScore: 20,
      },
      {
        contentsId: 13,
        contentsName: '후보 C',
        mediaFileId: 23,
        visibleType: 'PUBLIC',
        gameRank: 2,
        gameScore: 10,
      },
    ]);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { worldCupId: 3 },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        mediaFileId: true,
        visibleType: true,
      },
    });
    expect(groupBy).toHaveBeenCalledWith({
      by: ['candidateId'],
      where: { candidateId: { in: [11, 12, 13] } },
      _sum: { score: true },
    });
  });

  it('does not reveal a missing or another member world cup', async () => {
    const findMany = vi.fn();
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      candidate: { findMany },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.findAll(7, 99)).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns an empty list without requesting scores', async () => {
    const groupBy = vi.fn();
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: { findMany: vi.fn().mockResolvedValue([]) },
      gamePlacement: { groupBy },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.findAll(7, 3)).resolves.toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
