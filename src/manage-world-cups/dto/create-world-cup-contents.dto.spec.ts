import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorldCupContentsDto } from './create-world-cup-contents.dto.js';

function validContent(
  overrides: Record<string, unknown> = {},
  mediaOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contentsName: '  후보 A  ',
    visibleType: 'PUBLIC',
    createMediaFileRequest: {
      fileType: 'INTERNET_VIDEO_URL',
      mediaData: '  https://www.youtube.com/watch?v=video-id  ',
      originalName: 'generated-name',
      videoStartTime: '  00030  ',
      videoPlayDuration: '3',
      detailFileType: 'YOU_TUBE_URL',
      ...mediaOverrides,
    },
    ...overrides,
  };
}

async function validateRequest(data: unknown[]) {
  const dto = plainToInstance(CreateWorldCupContentsDto, { data });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('CreateWorldCupContentsDto', () => {
  it('accepts and normalizes a YouTube candidate batch', async () => {
    const { dto, errors } = await validateRequest([validContent()]);

    expect(errors).toHaveLength(0);
    expect(dto.data[0]).toMatchObject({
      contentsName: '후보 A',
      visibleType: 'PUBLIC',
      createMediaFileRequest: {
        fileType: 'INTERNET_VIDEO_URL',
        mediaData: 'https://www.youtube.com/watch?v=video-id',
        originalName: 'generated-name',
        videoStartTime: '00030',
        videoPlayDuration: 3,
        detailFileType: 'YOU_TUBE_URL',
      },
    });
  });

  it.each([0, 257])(
    'requires a batch size between 1 and 256: %i',
    async (size) => {
      const { errors } = await validateRequest(
        Array.from({ length: size }, () => validContent()),
      );

      expect(errors).not.toHaveLength(0);
    },
  );

  it.each([
    ['empty candidate name', { contentsName: '   ' }, {}],
    ['invalid visibility', { visibleType: 'OPEN' }, {}],
    ['static media file', {}, { fileType: 'STATIC_MEDIA_FILE' }],
    ['non-YouTube URL', {}, { mediaData: 'https://example.com/watch?v=id' }],
    [
      'YouTube URL without video id',
      {},
      { mediaData: 'https://www.youtube.com/watch' },
    ],
    [
      'YouTube URL with a blank video id',
      {},
      { mediaData: 'https://www.youtube.com/watch?v=%20' },
    ],
    ['non-HTTPS URL', {}, { mediaData: 'http://youtube.com/watch?v=id' }],
    ['invalid start time', {}, { videoStartTime: '0030' }],
    ['too short duration', {}, { videoPlayDuration: 2 }],
    ['too long duration', {}, { videoPlayDuration: 6 }],
    ['invalid detail type', {}, { detailFileType: 'MP4' }],
  ])('rejects %s', async (_label, contentOverrides, mediaOverrides) => {
    const { errors } = await validateRequest([
      validContent(contentOverrides, mediaOverrides),
    ]);

    expect(errors).not.toHaveLength(0);
  });

  it('rejects unknown nested request fields', async () => {
    const { errors } = await validateRequest([
      validContent({}, { unexpectedField: 'value' }),
    ]);

    expect(errors).not.toHaveLength(0);
  });
});
