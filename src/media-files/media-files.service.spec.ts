import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MediaSize } from './dto/get-media-file.query.js';
import { MediaFilesService } from './media-files.service.js';

const CREATED_AT = new Date('2026-09-07T00:00:00.000Z');
const UPDATED_AT = new Date('2026-09-07T01:00:00.000Z');

function createService(mediaFile: unknown): MediaFilesService {
  const prisma = {
    mediaFile: { findUnique: vi.fn().mockResolvedValue(mediaFile) },
  } as unknown as PrismaService;
  const config = {
    getOrThrow: vi.fn().mockReturnValue('https://media.example.com/iwtc'),
  } as unknown as ConfigService;
  return new MediaFilesService(prisma, config);
}

describe('MediaFilesService', () => {
  it('returns an encoded public object URL for a static file', async () => {
    const service = createService({
      id: 1,
      fileType: 'STATIC_MEDIA_FILE',
      detailType: 'PNG',
      objectKey: 'world cups/candidate A.png',
      thumbnailObjectKey: 'thumbnails/candidate A.png',
      externalUrl: null,
      originalName: 'candidate A.png',
      videoStartTime: null,
      videoPlayDuration: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });

    await expect(service.findOne(1, MediaSize.ORIGINAL)).resolves.toEqual({
      mediaFileId: 1,
      fileType: 'STATIC_MEDIA_FILE',
      mediaData:
        'https://media.example.com/iwtc/world%20cups/candidate%20A.png',
      originalName: 'candidate A.png',
      videoStartTime: null,
      videoPlayDuration: null,
      detailType: 'PNG',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
  });

  it('uses the thumbnail object when divide2 is requested', async () => {
    const service = createService({
      id: 1,
      fileType: 'STATIC_MEDIA_FILE',
      detailType: 'PNG',
      objectKey: 'original/candidate.png',
      thumbnailObjectKey: 'divide2/candidate.png',
      externalUrl: null,
      originalName: 'candidate.png',
      videoStartTime: null,
      videoPlayDuration: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });

    await expect(service.findOne(1, MediaSize.DIVIDE_2)).resolves.toMatchObject(
      {
        mediaData: 'https://media.example.com/iwtc/divide2/candidate.png',
      },
    );
  });

  it('falls back to the original object when a thumbnail is absent', async () => {
    const service = createService({
      id: 1,
      fileType: 'STATIC_MEDIA_FILE',
      detailType: 'PNG',
      objectKey: 'original/candidate.png',
      thumbnailObjectKey: null,
      externalUrl: null,
      originalName: 'candidate.png',
      videoStartTime: null,
      videoPlayDuration: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });

    await expect(service.findOne(1, MediaSize.DIVIDE_2)).resolves.toMatchObject(
      {
        mediaData: 'https://media.example.com/iwtc/original/candidate.png',
      },
    );
  });

  it('returns an external video URL unchanged', async () => {
    const service = createService({
      id: 2,
      fileType: 'INTERNET_VIDEO_URL',
      detailType: 'YOU_TUBE_URL',
      objectKey: null,
      thumbnailObjectKey: null,
      externalUrl: 'https://www.youtube.com/watch?v=example',
      originalName: null,
      videoStartTime: '00130',
      videoPlayDuration: 5,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });

    await expect(service.findOne(2, MediaSize.ORIGINAL)).resolves.toMatchObject(
      {
        mediaData: 'https://www.youtube.com/watch?v=example',
        videoStartTime: '00130',
        videoPlayDuration: 5,
      },
    );
  });

  it('rejects an unknown media file', async () => {
    const service = createService(null);

    await expect(
      service.findOne(999, MediaSize.ORIGINAL),
    ).rejects.toMatchObject({ status: 404 });
  });
});
