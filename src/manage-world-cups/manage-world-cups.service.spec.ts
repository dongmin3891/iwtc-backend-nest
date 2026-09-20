import { Logger } from '@nestjs/common';
import type { ObjectStorageService } from '../media-files/object-storage.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CreateManagedWorldCupDto } from './dto/create-managed-world-cup.dto.js';
import { ManageWorldCupsService } from './manage-world-cups.service.js';

function createObjectStorage(
  deleteObject = vi.fn().mockResolvedValue(undefined),
): ObjectStorageService {
  return { deleteObject } as unknown as ObjectStorageService;
}

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
    const service = new ManageWorldCupsService(prisma, createObjectStorage());

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
    const service = new ManageWorldCupsService(prisma, createObjectStorage());

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
    const service = new ManageWorldCupsService(prisma, createObjectStorage());

    await expect(service.findOne(7, 99)).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
  });

  it('creates a world cup owned by the authenticated member', async () => {
    const create = vi.fn().mockResolvedValue({ id: 11 });
    const prisma = { worldCup: { create } } as unknown as PrismaService;
    const service = new ManageWorldCupsService(prisma, createObjectStorage());
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

  it('deletes owned world cup relations and only orphan media in one transaction', async () => {
    const transaction = {
      worldCup: {
        findFirst: vi.fn().mockResolvedValue({
          id: 3,
          candidates: [
            { mediaFileId: 21 },
            { mediaFileId: 22 },
            { mediaFileId: 21 },
            { mediaFileId: 23 },
            { mediaFileId: null },
          ],
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      gamePlacement: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      comment: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      gamePlay: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      candidate: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
      mediaFile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 21,
            objectKey: 'world-cups/3/original.png',
            thumbnailObjectKey: 'world-cups/3/shared.png',
          },
          {
            id: 23,
            objectKey: 'world-cups/3/shared.png',
            thumbnailObjectKey: null,
          },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const committed = vi.fn();
    const prisma = {
      $transaction: vi.fn(
        async (operation: (client: typeof transaction) => Promise<unknown>) => {
          const result = await operation(transaction);
          committed();
          return result;
        },
      ),
    } as unknown as PrismaService;
    const deleteObject = vi.fn().mockImplementation(() => {
      expect(committed).toHaveBeenCalledOnce();
      return Promise.resolve();
    });
    const service = new ManageWorldCupsService(
      prisma,
      createObjectStorage(deleteObject),
    );

    await expect(service.remove(7, 3)).resolves.toBeUndefined();

    expect(transaction.worldCup.findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: {
        id: true,
        candidates: { select: { mediaFileId: true } },
      },
    });
    expect(transaction.gamePlacement.deleteMany).toHaveBeenCalledWith({
      where: { gamePlay: { worldCupId: 3 } },
    });
    expect(transaction.comment.deleteMany).toHaveBeenCalledWith({
      where: { worldCupId: 3 },
    });
    expect(transaction.gamePlay.deleteMany).toHaveBeenCalledWith({
      where: { worldCupId: 3 },
    });
    expect(transaction.candidate.deleteMany).toHaveBeenCalledWith({
      where: { worldCupId: 3 },
    });
    expect(transaction.mediaFile.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [21, 22, 23] },
        candidates: { none: {} },
      },
      select: {
        id: true,
        objectKey: true,
        thumbnailObjectKey: true,
      },
    });
    expect(transaction.mediaFile.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [21, 23] } },
    });
    expect(transaction.worldCup.deleteMany).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
    });
    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenNthCalledWith(
      1,
      'world-cups/3/original.png',
    );
    expect(deleteObject).toHaveBeenNthCalledWith(2, 'world-cups/3/shared.png');

    expect(
      transaction.gamePlacement.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(transaction.comment.deleteMany.mock.invocationCallOrder[0]!);
    expect(
      transaction.comment.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transaction.gamePlay.deleteMany.mock.invocationCallOrder[0]!,
    );
    expect(
      transaction.gamePlay.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transaction.candidate.deleteMany.mock.invocationCallOrder[0]!,
    );
    expect(
      transaction.candidate.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transaction.worldCup.deleteMany.mock.invocationCallOrder[0]!,
    );
  });

  it('does not reveal or delete a missing or another member world cup', async () => {
    const transaction = {
      worldCup: {
        findFirst: vi.fn().mockResolvedValue(null),
        deleteMany: vi.fn(),
      },
      gamePlacement: { deleteMany: vi.fn() },
      comment: { deleteMany: vi.fn() },
      gamePlay: { deleteMany: vi.fn() },
      candidate: { deleteMany: vi.fn() },
      mediaFile: { findMany: vi.fn(), deleteMany: vi.fn() },
    };
    const prisma = {
      $transaction: (operation: (client: typeof transaction) => unknown) =>
        operation(transaction),
    } as unknown as PrismaService;
    const deleteObject = vi.fn();
    const service = new ManageWorldCupsService(
      prisma,
      createObjectStorage(deleteObject),
    );

    await expect(service.remove(8, 3)).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
    expect(transaction.gamePlacement.deleteMany).not.toHaveBeenCalled();
    expect(transaction.worldCup.deleteMany).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('does not remove storage objects when the database transaction fails', async () => {
    const databaseError = new Error('database delete failed');
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaService;
    const deleteObject = vi.fn();
    const service = new ManageWorldCupsService(
      prisma,
      createObjectStorage(deleteObject),
    );

    await expect(service.remove(7, 3)).rejects.toBe(databaseError);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('retries storage cleanup after commit and logs the final failure', async () => {
    const transaction = {
      worldCup: {
        findFirst: vi.fn().mockResolvedValue({
          id: 3,
          candidates: [{ mediaFileId: 21 }],
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      gamePlacement: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      comment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      gamePlay: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      candidate: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      mediaFile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 21,
            objectKey: 'world-cups/3/original.png',
            thumbnailObjectKey: null,
          },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<unknown>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const deleteObject = vi.fn().mockRejectedValue(new Error('S3 unavailable'));
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const service = new ManageWorldCupsService(
      prisma,
      createObjectStorage(deleteObject),
    );

    await expect(service.remove(7, 3)).resolves.toBeUndefined();

    expect(deleteObject).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      '월드컵 DB 삭제 후 미디어 객체 정리에 실패했습니다: world-cups/3/original.png',
      expect.any(String),
    );

    warn.mockRestore();
    error.mockRestore();
  });
});
