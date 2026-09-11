import { BadRequestException } from '@nestjs/common';
import {
  type UploadedStaticImage,
  validateStaticImage,
} from './static-image-file.js';

function file(
  mimetype: string,
  buffer: Buffer,
  originalname = 'image',
): UploadedStaticImage {
  return { buffer, mimetype, originalname, size: buffer.length };
}

describe('validateStaticImage', () => {
  it.each([
    [
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { detailType: 'PNG', extension: 'png' },
    ],
    [
      'image/jpeg',
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      { detailType: 'JPEG', extension: 'jpg' },
    ],
    [
      'image/gif',
      Buffer.from('GIF89a'),
      { detailType: 'GIF', extension: 'gif' },
    ],
  ])('accepts a valid %s signature', (mimetype, buffer, expected) => {
    expect(validateStaticImage(file(mimetype, buffer))).toEqual(expected);
  });

  it('rejects a missing file', () => {
    expect(() => validateStaticImage(undefined)).toThrow(BadRequestException);
  });

  it('rejects a MIME type that does not match the file signature', () => {
    expect(() =>
      validateStaticImage(file('image/png', Buffer.from('GIF89a'))),
    ).toThrow('JPEG, PNG 또는 GIF 이미지 파일만 업로드할 수 있습니다.');
  });
});
