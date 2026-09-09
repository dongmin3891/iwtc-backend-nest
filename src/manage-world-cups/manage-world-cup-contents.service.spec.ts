import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorldCupContentDto } from './dto/create-world-cup-contents.dto.js';
import { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';

function youtubeCandidate(
  contentsName = '후보 A',
  videoId = 'video-id',
): CreateWorldCupContentDto {
  return {
    contentsName,
    visibleType: 'PRIVATE',
    createMediaFileRequest: {
      fileType: 'INTERNET_VIDEO_URL',
      mediaData: `https://www.youtube.com/watch?v=${videoId}`,
      originalName: 'ignored-name',
      videoStartTime: '00030',
      videoPlayDuration: 3,
      detailFileType: 'YOU_TUBE_URL',
    },
  };
}

describe('ManageWorldCupContentsService', () => {
  it('stores multiple candidates in request order with consecutive sort orders', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 15 })
          .mockResolvedValueOnce({ id: 16 })
          .mockResolvedValueOnce({ id: 17 }),
      },
      mediaFile: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 25 })
          .mockResolvedValueOnce({ id: 26 })
          .mockResolvedValueOnce({ id: 27 }),
      },
    };
    const $transaction = vi
      .fn()
      .mockImplementation(
        (operation: (client: typeof transaction) => Promise<number[]>) =>
          operation(transaction),
      );
    const service = new ManageWorldCupContentsService({
      $transaction,
    } as unknown as PrismaService);

    await expect(
      service.createMany(7, 3, [
        youtubeCandidate('후보 A', 'video-a'),
        youtubeCandidate('후보 B', 'video-b'),
        youtubeCandidate('후보 C', 'video-c'),
      ]),
    ).resolves.toEqual([15, 16, 17]);

    expect($transaction).toHaveBeenCalledOnce();
    expect(transaction.worldCup.findFirst).toHaveBeenCalledOnce();
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.candidate.findFirst).toHaveBeenCalledOnce();
    const [query, lockNamespace, lockedWorldCupId] =
      transaction.$queryRaw.mock.calls[0]!;
    expect(Array.from(query as TemplateStringsArray)).toEqual([
      '\n        SELECT pg_advisory_xact_lock(\n          CAST(',
      ' AS INTEGER),\n          CAST(',
      ' AS INTEGER)\n        )\n      ',
    ]);
    expect(lockNamespace).toBe(0x49575443);
    expect(lockedWorldCupId).toBe(3);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.candidate.findFirst.mock.invocationCallOrder[0]!,
    );
    expect(transaction.candidate.create).toHaveBeenNthCalledWith(1, {
      data: {
        worldCupId: 3,
        name: '후보 A',
        mediaFileId: 25,
        visibleType: 'PRIVATE',
        sortOrder: 5,
      },
      select: { id: true },
    });
    expect(transaction.candidate.create).toHaveBeenNthCalledWith(2, {
      data: {
        worldCupId: 3,
        name: '후보 B',
        mediaFileId: 26,
        visibleType: 'PRIVATE',
        sortOrder: 6,
      },
      select: { id: true },
    });
    expect(transaction.candidate.create).toHaveBeenNthCalledWith(3, {
      data: {
        worldCupId: 3,
        name: '후보 C',
        mediaFileId: 27,
        visibleType: 'PRIVATE',
        sortOrder: 7,
      },
      select: { id: true },
    });
  });

  it('rejects the single transaction when a middle candidate fails', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 15 })
          .mockRejectedValueOnce(new Error('candidate write failed')),
      },
      mediaFile: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 25 })
          .mockResolvedValueOnce({ id: 26 }),
      },
    };
    const $transaction = vi
      .fn()
      .mockImplementation(
        (operation: (client: typeof transaction) => Promise<number[]>) =>
          operation(transaction),
      );
    const service = new ManageWorldCupContentsService({
      $transaction,
    } as unknown as PrismaService);

    await expect(
      service.createMany(7, 3, [
        youtubeCandidate('후보 A', 'video-a'),
        youtubeCandidate('후보 B', 'video-b'),
        youtubeCandidate('후보 C', 'video-c'),
      ]),
    ).rejects.toThrow('candidate write failed');

    expect($transaction).toHaveBeenCalledOnce();
    expect(transaction.mediaFile.create).toHaveBeenCalledTimes(2);
    expect(transaction.candidate.create).toHaveBeenCalledTimes(2);
  });

  it('stores one owned YouTube candidate and its media in one transaction', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
        create: vi.fn().mockResolvedValue({ id: 15 }),
      },
      mediaFile: { create: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const $transaction = vi
      .fn()
      .mockImplementation(
        (operation: (client: typeof transaction) => Promise<number[]>) =>
          operation(transaction),
      );
    const service = new ManageWorldCupContentsService({
      $transaction,
    } as unknown as PrismaService);

    await expect(service.createOne(7, 3, youtubeCandidate())).resolves.toBe(15);
    expect($transaction).toHaveBeenCalledOnce();
    expect(transaction.worldCup.findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: { id: true },
    });
    expect(transaction.candidate.findFirst).toHaveBeenCalledWith({
      where: { worldCupId: 3 },
      orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
      select: { sortOrder: true },
    });
    expect(transaction.mediaFile.create).toHaveBeenCalledWith({
      data: {
        fileType: 'INTERNET_VIDEO_URL',
        detailType: 'YOU_TUBE_URL',
        objectKey: null,
        thumbnailObjectKey: null,
        externalUrl: 'https://www.youtube.com/watch?v=video-id',
        originalName: null,
        videoStartTime: '00030',
        videoPlayDuration: 3,
      },
      select: { id: true },
    });
    expect(transaction.candidate.create).toHaveBeenCalledWith({
      data: {
        worldCupId: 3,
        name: '후보 A',
        mediaFileId: 25,
        visibleType: 'PRIVATE',
        sortOrder: 5,
      },
      select: { id: true },
    });
  });

  it('starts the candidate order at zero for an empty world cup', async () => {
    const candidateCreate = vi.fn().mockResolvedValue({ id: 15 });
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: candidateCreate,
      },
      mediaFile: { create: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await service.createOne(7, 3, youtubeCandidate());

    expect(candidateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 0 }),
      }),
    );
  });

  it('does not write media or a candidate when the member is not the owner', async () => {
    const transaction = {
      $queryRaw: vi.fn(),
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      candidate: { findFirst: vi.fn(), create: vi.fn() },
      mediaFile: { create: vi.fn() },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(
      service.createOne(8, 3, youtubeCandidate()),
    ).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
    expect(transaction.candidate.findFirst).not.toHaveBeenCalled();
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
    expect(transaction.mediaFile.create).not.toHaveBeenCalled();
    expect(transaction.candidate.create).not.toHaveBeenCalled();
  });

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
