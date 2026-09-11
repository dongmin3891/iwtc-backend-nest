import type { PrismaService } from '../prisma/prisma.service.js';
import type { ObjectStorageService } from '../media-files/object-storage.service.js';
import type { CreateWorldCupContentDto } from './dto/create-world-cup-contents.dto.js';
import type { UpdateWorldCupContentsDto } from './dto/update-world-cup-contents.dto.js';
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

function youtubeCandidateUpdate(): UpdateWorldCupContentsDto {
  return {
    contentsName: '수정 후보',
    originalName: 'ignored-name',
    mediaData: 'https://www.youtube.com/watch?v=updated-video',
    detailFileType: 'YOU_TUBE_URL',
    videoStartTime: '00120',
    videoPlayDuration: 5,
    visibleType: 'PUBLIC',
  };
}

describe('ManageWorldCupContentsService', () => {
  it('updates static candidate fields without replacing its image', async () => {
    const currentCandidate = {
      id: 15,
      mediaFile: {
        id: 25,
        fileType: 'STATIC_MEDIA_FILE',
        objectKey: 'world-cups/3/candidates/old.png',
      },
    };
    const transaction = {
      candidate: {
        findFirst: vi.fn().mockResolvedValue(currentCandidate),
        update: vi.fn().mockResolvedValue({ id: 15 }),
      },
      mediaFile: { update: vi.fn() },
    };
    const prisma = {
      candidate: { findFirst: vi.fn().mockResolvedValue(currentCandidate) },
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<number>) =>
          operation(transaction),
      ),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn(),
      deleteObject: vi.fn(),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);

    await expect(
      service.updateStaticImage(7, 3, 15, {
        contentsName: '수정 이미지 후보',
        visibleType: 'PRIVATE',
      }),
    ).resolves.toBe(15);

    expect(transaction.candidate.update).toHaveBeenCalledWith({
      where: { id: 15 },
      data: { name: '수정 이미지 후보', visibleType: 'PRIVATE' },
    });
    expect(transaction.mediaFile.update).not.toHaveBeenCalled();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('replaces a static candidate image and removes the previous object', async () => {
    const currentCandidate = {
      id: 15,
      mediaFile: {
        id: 25,
        fileType: 'STATIC_MEDIA_FILE',
        objectKey: 'world-cups/3/candidates/old.png',
      },
    };
    const transaction = {
      candidate: {
        findFirst: vi.fn().mockResolvedValue(currentCandidate),
        update: vi.fn().mockResolvedValue({ id: 15 }),
      },
      mediaFile: { update: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const prisma = {
      candidate: { findFirst: vi.fn().mockResolvedValue(currentCandidate) },
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<number>) =>
          operation(transaction),
      ),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);
    const file = {
      buffer: Buffer.from('GIF89a'),
      mimetype: 'image/gif',
      originalname: 'new.gif',
      size: 6,
    };

    await service.updateStaticImage(
      7,
      3,
      15,
      { contentsName: '교체 후보', visibleType: 'PUBLIC' },
      file,
    );

    const newObjectKey = vi.mocked(objectStorage.putObject).mock.calls[0]![0]
      .key;
    expect(newObjectKey).toMatch(
      /^world-cups\/3\/candidates\/[0-9a-f-]+\.gif$/,
    );
    expect(transaction.mediaFile.update).toHaveBeenCalledWith({
      where: { id: 25 },
      data: {
        fileType: 'STATIC_MEDIA_FILE',
        detailType: 'GIF',
        objectKey: newObjectKey,
        thumbnailObjectKey: null,
        externalUrl: null,
        originalName: 'new.gif',
        videoStartTime: null,
        videoPlayDuration: null,
      },
    });
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(
      'world-cups/3/candidates/old.png',
    );
  });

  it('removes the replacement image when the static update transaction fails', async () => {
    const databaseError = new Error('database unavailable');
    const prisma = {
      candidate: {
        findFirst: vi.fn().mockResolvedValue({
          id: 15,
          mediaFile: {
            id: 25,
            fileType: 'STATIC_MEDIA_FILE',
            objectKey: 'world-cups/3/candidates/old.png',
          },
        }),
      },
      $transaction: vi.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);

    await expect(
      service.updateStaticImage(
        7,
        3,
        15,
        { contentsName: '교체 후보', visibleType: 'PUBLIC' },
        {
          buffer: Buffer.from('GIF89a'),
          mimetype: 'image/gif',
          originalname: 'new.gif',
          size: 6,
        },
      ),
    ).rejects.toBe(databaseError);

    const newObjectKey = vi.mocked(objectStorage.putObject).mock.calls[0]![0]
      .key;
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(newObjectKey);
    expect(objectStorage.deleteObject).not.toHaveBeenCalledWith(
      'world-cups/3/candidates/old.png',
    );
  });

  it('uploads and stores a static image candidate with the next sort order', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
        create: vi.fn().mockResolvedValue({ id: 15 }),
      },
      mediaFile: { create: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      $transaction: vi.fn(
        (operation: (client: typeof transaction) => Promise<number>) =>
          operation(transaction),
      ),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn(),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);
    const image = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mimetype: 'image/png',
      originalname: '후보.png',
      size: 8,
    };

    await expect(
      service.createStaticImage(
        7,
        3,
        { contentsName: '이미지 후보', visibleType: 'PRIVATE' },
        image,
      ),
    ).resolves.toBe(15);

    expect(objectStorage.putObject).toHaveBeenCalledWith({
      key: expect.stringMatching(
        /^world-cups\/3\/candidates\/[0-9a-f-]+\.png$/,
      ),
      body: image.buffer,
      contentType: 'image/png',
    });
    const objectKey = vi.mocked(objectStorage.putObject).mock.calls[0]![0].key;
    expect(transaction.mediaFile.create).toHaveBeenCalledWith({
      data: {
        fileType: 'STATIC_MEDIA_FILE',
        detailType: 'PNG',
        objectKey,
        thumbnailObjectKey: null,
        externalUrl: null,
        originalName: '후보.png',
        videoStartTime: null,
        videoPlayDuration: null,
      },
      select: { id: true },
    });
    expect(transaction.candidate.create).toHaveBeenCalledWith({
      data: {
        worldCupId: 3,
        name: '이미지 후보',
        mediaFileId: 25,
        visibleType: 'PRIVATE',
        sortOrder: 5,
      },
      select: { id: true },
    });
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('removes an uploaded image if database storage fails', async () => {
    const databaseError = new Error('database unavailable');
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      $transaction: vi.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);

    await expect(
      service.createStaticImage(
        7,
        3,
        { contentsName: '이미지 후보', visibleType: 'PUBLIC' },
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
          mimetype: 'image/jpeg',
          originalname: 'candidate.jpg',
          size: 3,
        },
      ),
    ).rejects.toBe(databaseError);

    const objectKey = vi.mocked(objectStorage.putObject).mock.calls[0]![0].key;
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it('does not upload an image when the member does not own the world cup', async () => {
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn(),
      deleteObject: vi.fn(),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);

    await expect(
      service.createStaticImage(
        7,
        99,
        { contentsName: '이미지 후보', visibleType: 'PRIVATE' },
        {
          buffer: Buffer.from('GIF89a'),
          mimetype: 'image/gif',
          originalname: 'candidate.gif',
          size: 6,
        },
      ),
    ).rejects.toThrow('월드컵을 찾을 수 없습니다.');

    expect(objectStorage.putObject).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not write to the database when image upload fails', async () => {
    const storageError = new Error('object storage unavailable');
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const objectStorage = {
      putObject: vi.fn().mockRejectedValue(storageError),
      deleteObject: vi.fn(),
    } as unknown as ObjectStorageService;
    const service = new ManageWorldCupContentsService(prisma, objectStorage);

    await expect(
      service.createStaticImage(
        7,
        3,
        { contentsName: '이미지 후보', visibleType: 'PUBLIC' },
        {
          buffer: Buffer.from('GIF89a'),
          mimetype: 'image/gif',
          originalname: 'candidate.gif',
          size: 6,
        },
      ),
    ).rejects.toBe(storageError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('stores multiple candidates in request order with consecutive sort orders', async () => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
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
      '\n      SELECT pg_advisory_xact_lock(\n        CAST(',
      ' AS INTEGER),\n        CAST(',
      ' AS INTEGER)\n      ) IS NULL AS "locked"\n    ',
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
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
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
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
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
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
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

  it('updates an owned candidate and its YouTube media in one transaction', async () => {
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ id: 15, mediaFileId: 25 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mediaFile: { update: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const $transaction = vi
      .fn()
      .mockImplementation(
        (operation: (client: typeof transaction) => Promise<number>) =>
          operation(transaction),
      );
    const service = new ManageWorldCupContentsService({
      $transaction,
    } as unknown as PrismaService);

    await expect(
      service.updateOne(7, 3, 15, youtubeCandidateUpdate()),
    ).resolves.toBe(15);

    expect($transaction).toHaveBeenCalledOnce();
    expect(transaction.worldCup.findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: { id: true },
    });
    expect(transaction.candidate.findFirst).toHaveBeenCalledWith({
      where: { id: 15, worldCupId: 3, deletedAt: null },
      select: { id: true, mediaFileId: true },
    });
    expect(transaction.mediaFile.update).toHaveBeenCalledWith({
      where: { id: 25 },
      data: {
        fileType: 'INTERNET_VIDEO_URL',
        detailType: 'YOU_TUBE_URL',
        objectKey: null,
        thumbnailObjectKey: null,
        externalUrl: 'https://www.youtube.com/watch?v=updated-video',
        originalName: null,
        videoStartTime: '00120',
        videoPlayDuration: 5,
      },
    });
    expect(transaction.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: 15, worldCupId: 3, deletedAt: null },
      data: { name: '수정 후보', visibleType: 'PUBLIC' },
    });
    expect(
      transaction.mediaFile.update.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transaction.candidate.updateMany.mock.invocationCallOrder[0]!,
    );
  });

  it('does not look up or update a candidate when the member is not the owner', async () => {
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      candidate: { findFirst: vi.fn(), updateMany: vi.fn() },
      mediaFile: { update: vi.fn() },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(
      service.updateOne(8, 3, 15, youtubeCandidateUpdate()),
    ).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
    expect(transaction.candidate.findFirst).not.toHaveBeenCalled();
    expect(transaction.mediaFile.update).not.toHaveBeenCalled();
    expect(transaction.candidate.updateMany).not.toHaveBeenCalled();
  });

  it('does not reveal a deleted, missing, or another world cup candidate', async () => {
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
      },
      mediaFile: { update: vi.fn() },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(
      service.updateOne(7, 3, 99, youtubeCandidateUpdate()),
    ).rejects.toMatchObject({
      status: 404,
      message: '월드컵 후보를 찾을 수 없습니다.',
    });
    expect(transaction.candidate.findFirst).toHaveBeenCalledWith({
      where: { id: 99, worldCupId: 3, deletedAt: null },
      select: { id: true, mediaFileId: true },
    });
    expect(transaction.mediaFile.update).not.toHaveBeenCalled();
    expect(transaction.candidate.updateMany).not.toHaveBeenCalled();
  });

  it('does not update a candidate without a linked media file', async () => {
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ id: 15, mediaFileId: null }),
        updateMany: vi.fn(),
      },
      mediaFile: { update: vi.fn() },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(
      service.updateOne(7, 3, 15, youtubeCandidateUpdate()),
    ).rejects.toMatchObject({
      status: 404,
      message: '미디어 파일을 찾을 수 없습니다.',
    });
    expect(transaction.mediaFile.update).not.toHaveBeenCalled();
    expect(transaction.candidate.updateMany).not.toHaveBeenCalled();
  });

  it('fails the transaction when the candidate is deleted during an update', async () => {
    const transaction = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: {
        findFirst: vi.fn().mockResolvedValue({ id: 15, mediaFileId: 25 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      mediaFile: { update: vi.fn().mockResolvedValue({ id: 25 }) },
    };
    const prisma = {
      $transaction: (
        operation: (client: typeof transaction) => Promise<number>,
      ) => operation(transaction),
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(
      service.updateOne(7, 3, 15, youtubeCandidateUpdate()),
    ).rejects.toMatchObject({
      status: 404,
      message: '월드컵 후보를 찾을 수 없습니다.',
    });
    expect(transaction.mediaFile.update).toHaveBeenCalledOnce();
    expect(transaction.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: 15, worldCupId: 3, deletedAt: null },
      data: { name: '수정 후보', visibleType: 'PUBLIC' },
    });
  });

  it('soft-deletes an active candidate from an owned world cup', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 3 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      worldCup: { findFirst },
      candidate: { updateMany },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.remove(7, 3, 15)).resolves.toBeUndefined();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 3, ownerId: 7 },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 15, worldCupId: 3, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('does not delete a candidate when the member does not own the world cup', async () => {
    const updateMany = vi.fn();
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      candidate: { updateMany },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.remove(8, 3, 15)).rejects.toMatchObject({
      status: 404,
      message: '월드컵을 찾을 수 없습니다.',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects deletion of a deleted, missing, or another world cup candidate', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      candidate: { updateMany },
    } as unknown as PrismaService;
    const service = new ManageWorldCupContentsService(prisma);

    await expect(service.remove(7, 3, 99)).rejects.toMatchObject({
      status: 404,
      message: '월드컵 후보를 찾을 수 없습니다.',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 99, worldCupId: 3, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('returns active owned contents in management order with derived scores and ranks', async () => {
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
      where: { worldCupId: 3, deletedAt: null },
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
