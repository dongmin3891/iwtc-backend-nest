import type { PrismaService } from '../prisma/prisma.service.js';
import { CreateManagedWorldCupDto } from './dto/create-managed-world-cup.dto.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';

describe('ManageWorldCupsService', () => {
  it('returns only the authenticated member world cups in newest-first order', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 3,
        title: '세 번째 월드컵',
        description: '설명',
        visibleType: 'PRIVATE',
      },
    ]);
    const prisma = { worldCup: { findMany } } as unknown as PrismaService;
    const service = new ManageWorldCupsService(prisma);

    await expect(service.findAll(7)).resolves.toEqual([
      {
        worldCupId: 3,
        title: '세 번째 월드컵',
        description: '설명',
        visibleType: 'PRIVATE',
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { ownerId: 7 },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        visibleType: true,
      },
    });
  });

  it('returns a world cup only when the authenticated member owns it', async () => {
    const createdAt = new Date('2026-09-09T00:00:00.000Z');
    const updatedAt = new Date('2026-09-09T01:00:00.000Z');
    const findFirst = vi.fn().mockResolvedValue({
      id: 3,
      title: '내 월드컵',
      description: '',
      visibleType: 'PUBLIC',
      createdAt,
      updatedAt,
    });
    const prisma = { worldCup: { findFirst } } as unknown as PrismaService;
    const service = new ManageWorldCupsService(prisma);

    await expect(service.findOne(7, 3)).resolves.toEqual({
      worldCupId: 3,
      title: '내 월드컵',
      description: '',
      visibleType: 'PUBLIC',
      createdAt,
      updatedAt,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: {
        id: true,
        title: true,
        description: true,
        visibleType: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('does not reveal a missing or another member world cup', async () => {
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new ManageWorldCupsService(prisma);

    await expect(service.findOne(7, 99)).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
  });

  it('creates a world cup owned by the authenticated member', async () => {
    const create = vi.fn().mockResolvedValue({ id: 11 });
    const prisma = { worldCup: { create } } as unknown as PrismaService;
    const service = new ManageWorldCupsService(prisma);
    const request = new CreateManagedWorldCupDto();
    request.title = '새 월드컵';
    request.visibleType = 'PRIVATE';

    await expect(service.create(7, request)).resolves.toBe(11);
    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: 7,
        title: '새 월드컵',
        description: '',
        visibleType: 'PRIVATE',
      },
      select: { id: true },
    });
  });
});
