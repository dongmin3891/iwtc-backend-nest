import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface MediaSourceAttribution {
  sourceProvider: string;
  sourceExternalId: string;
  sourceUrl: string;
  sourceAuthor: string;
  sourceAuthorUrl: string;
}

@Injectable()
export class AutomationWorldCupAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async saveCandidateAttribution(
    memberId: number,
    worldCupId: number,
    candidateId: number,
    attribution: MediaSourceAttribution,
  ): Promise<void> {
    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        worldCupId,
        deletedAt: null,
        worldCup: { ownerId: memberId },
      },
      select: { mediaFileId: true },
    });

    if (!candidate?.mediaFileId) {
      throw new NotFoundException('미디어 파일을 찾을 수 없습니다.');
    }

    await this.prisma.mediaFile.update({
      where: { id: candidate.mediaFileId },
      data: attribution,
    });
  }
}
