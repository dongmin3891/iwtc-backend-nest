import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateWorldCupContentsDto } from './update-world-cup-contents.dto.js';

function validRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contentsName: '  후보 A  ',
    originalName: '  generated-name  ',
    mediaData: '  https://www.youtube.com/watch?v=video-id  ',
    detailFileType: 'YOU_TUBE_URL',
    videoStartTime: '  00030  ',
    videoPlayDuration: '3',
    visibleType: 'PUBLIC',
    ...overrides,
  };
}

async function validateRequest(request: Record<string, unknown>) {
  const dto = plainToInstance(UpdateWorldCupContentsDto, request);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('UpdateWorldCupContentsDto', () => {
  it('accepts and normalizes a YouTube candidate update', async () => {
    const { dto, errors } = await validateRequest(validRequest());

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      contentsName: '후보 A',
      originalName: 'generated-name',
      mediaData: 'https://www.youtube.com/watch?v=video-id',
      detailFileType: 'YOU_TUBE_URL',
      videoStartTime: '00030',
      videoPlayDuration: 3,
      visibleType: 'PUBLIC',
    });
  });

  it('accepts the compatibility originalName field when omitted', async () => {
    const request = validRequest();
    delete request.originalName;

    const { errors } = await validateRequest(request);

    expect(errors).toHaveLength(0);
  });

  it.each([
    ['empty candidate name', { contentsName: '   ' }],
    ['too long candidate name', { contentsName: 'a'.repeat(101) }],
    ['invalid visibility', { visibleType: 'OPEN' }],
    ['non-YouTube URL', { mediaData: 'https://example.com/watch?v=id' }],
    [
      'YouTube URL without video id',
      { mediaData: 'https://www.youtube.com/watch' },
    ],
    [
      'YouTube URL with a blank video id',
      { mediaData: 'https://www.youtube.com/watch?v=%20' },
    ],
    ['non-HTTPS URL', { mediaData: 'http://youtube.com/watch?v=id' }],
    ['invalid start time', { videoStartTime: '0030' }],
    ['null start time', { videoStartTime: null }],
    ['too short duration', { videoPlayDuration: 2 }],
    ['too long duration', { videoPlayDuration: 6 }],
    ['non-integer duration', { videoPlayDuration: 3.5 }],
    ['null duration', { videoPlayDuration: null }],
    ['invalid detail type', { detailFileType: 'PNG' }],
  ])('rejects %s', async (_label, overrides) => {
    const { errors } = await validateRequest(validRequest(overrides));

    expect(errors).not.toHaveLength(0);
  });

  it.each([
    'contentsName',
    'mediaData',
    'detailFileType',
    'videoStartTime',
    'videoPlayDuration',
    'visibleType',
  ])('requires %s', async (field) => {
    const request = validRequest();
    delete request[field];

    const { errors } = await validateRequest(request);

    expect(errors).not.toHaveLength(0);
  });

  it('rejects unknown request fields', async () => {
    const { errors } = await validateRequest(
      validRequest({ unexpectedField: 'value' }),
    );

    expect(errors).not.toHaveLength(0);
  });
});
