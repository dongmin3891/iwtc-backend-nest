import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaSize } from './dto/get-media-file.query.js';
import type { MediaFileResponse } from './media-files.types.js';

@Injectable()
export class MediaFilesService {
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.publicBaseUrl = config.getOrThrow<string>('MEDIA_PUBLIC_BASE_URL');
  }

  async findOne(id: number, size: MediaSize): Promise<MediaFileResponse> {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id },
    });
    if (!mediaFile) {
      throw new NotFoundException('미디어 파일을 찾을 수 없습니다.');
    }

    const mediaData =
      mediaFile.fileType === 'INTERNET_VIDEO_URL'
        ? mediaFile.externalUrl
        : this.objectUrl(
            size === MediaSize.DIVIDE_2 && mediaFile.thumbnailObjectKey
              ? mediaFile.thumbnailObjectKey
              : mediaFile.objectKey,
          );

    if (!mediaData) {
      throw new NotFoundException('미디어 데이터를 찾을 수 없습니다.');
    }

    return {
      mediaFileId: mediaFile.id,
      fileType: mediaFile.fileType,
      mediaData,
      originalName: mediaFile.originalName,
      videoStartTime: mediaFile.videoStartTime,
      videoPlayDuration: mediaFile.videoPlayDuration,
      detailType: mediaFile.detailType,
      createdAt: mediaFile.createdAt,
      updatedAt: mediaFile.updatedAt,
    };
  }

  private objectUrl(objectKey: string | null): string | null {
    if (!objectKey) {
      return null;
    }
    const encodedKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.publicBaseUrl}/${encodedKey}`;
  }
}
