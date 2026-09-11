import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { MediaDetailType } from '../generated/prisma/enums.js';

export const MAX_STATIC_IMAGE_SIZE = 10 * 1024 * 1024;

export interface UploadedStaticImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ValidatedStaticImage {
  detailType: MediaDetailType;
  extension: 'gif' | 'jpg' | 'png';
}

const imageTypes = {
  'image/gif': {
    detailType: 'GIF',
    extension: 'gif',
    matches: (buffer: Buffer) =>
      buffer.subarray(0, 6).equals(Buffer.from('GIF87a')) ||
      buffer.subarray(0, 6).equals(Buffer.from('GIF89a')),
  },
  'image/jpeg': {
    detailType: 'JPEG',
    extension: 'jpg',
    matches: (buffer: Buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  'image/png': {
    detailType: 'PNG',
    extension: 'png',
    matches: (buffer: Buffer) =>
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
} as const;

export function validateStaticImage(
  file: UploadedStaticImage | undefined,
): ValidatedStaticImage {
  if (!file) {
    throw new BadRequestException('이미지 파일이 필요합니다.');
  }
  if (file.size <= 0 || file.buffer.length <= 0) {
    throw new BadRequestException('빈 이미지 파일은 업로드할 수 없습니다.');
  }
  if (file.size > MAX_STATIC_IMAGE_SIZE) {
    throw new BadRequestException('이미지 파일은 10MB 이하여야 합니다.');
  }
  if (file.originalname.length > 255) {
    throw new BadRequestException('이미지 파일 이름은 255자 이하여야 합니다.');
  }

  const imageType = imageTypes[file.mimetype as keyof typeof imageTypes];
  if (!imageType || !imageType.matches(file.buffer)) {
    throw new BadRequestException(
      'JPEG, PNG 또는 GIF 이미지 파일만 업로드할 수 있습니다.',
    );
  }

  return {
    detailType: imageType.detailType,
    extension: imageType.extension,
  };
}

@Injectable()
export class StaticImageFilePipe implements PipeTransform<
  UploadedStaticImage | undefined,
  UploadedStaticImage
> {
  transform(file: UploadedStaticImage | undefined): UploadedStaticImage {
    validateStaticImage(file);
    return file!;
  }
}
