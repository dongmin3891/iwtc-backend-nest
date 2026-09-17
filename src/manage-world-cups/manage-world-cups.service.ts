import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateManagedWorldCupDto } from './dto/create-managed-world-cup.dto.js';
import type {
  ManagedWorldCupDetail,
  ManagedWorldCupSummary,
} from './manage-world-cups.types.js';

export interface PublishedAutomationWorldCup {
  worldCupId: number;
  title: string;
  candidateCount: number;
  status: 'PUBLIC';
}

@Injectable()
export class ManageWorldCupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(memberId: number): Promise<ManagedWorldCupSummary[]> {
    const worldCups = await this.prisma.worldCup.findMany({
      where: { ownerId: memberId },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        visibleType: true,
      },
    });

    return worldCups.map((worldCup) => ({
      worldCupId: worldCup.id,
      title: worldCup.title,
      description: worldCup.description,
      visibleType: worldCup.visibleType,
    }));
  }

  async findOne(
    memberId: number,
    worldCupId: number,
  ): Promise<ManagedWorldCupDetail> {
    const worldCup = await this.prisma.worldCup.findFirst({
      where: { id: worldCupId, ownerId: memberId },
      select: {
        id: true,
        title: true,
        description: true,
        visibleType: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!worldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    return {
      worldCupId: worldCup.id,
      title: worldCup.title,
      description: worldCup.description,
      visibleType: worldCup.visibleType,
      createdAt: worldCup.createdAt,
      updatedAt: worldCup.updatedAt,
    };
  }

  async create(
    memberId: number,
    request: CreateManagedWorldCupDto,
  ): Promise<number> {
    const worldCup = await this.prisma.worldCup.create({
      data: {
        ownerId: memberId,
        title: request.title,
        description: request.description ?? '',
        visibleType: request.visibleType,
      },
      select: { id: true },
    });

    return worldCup.id;
  }

  async publishAutomationDraft(
    memberId: number,
    worldCupId: number,
  ): Promise<PublishedAutomationWorldCup> {
    return this.prisma.$transaction(async (tx) => {
      const worldCup = await tx.worldCup.findFirst({
        where: { id: worldCupId, ownerId: memberId },
        select: {
          id: true,
          title: true,
          candidates: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              mediaFileId: true,
              mediaFile: {
                select: {
                  sourceProvider: true,
                  sourceExternalId: true,
                  sourceUrl: true,
                  sourceAuthor: true,
                  sourceAuthorUrl: true,
                },
              },
            },
          },
        },
      });

      if (!worldCup) {
        throw new NotFoundException('월드컵을 찾을 수 없습니다.');
      }

      if (worldCup.candidates.length < 2) {
        throw new BadRequestException('공개하려면 후보가 최소 2개 필요합니다.');
      }

      const invalidAttributionCandidateIds = worldCup.candidates
        .filter((candidate) => {
          const media = candidate.mediaFile;
          return (
            !candidate.mediaFileId ||
            !media ||
            media.sourceProvider !== 'PEXELS' ||
            !media.sourceExternalId ||
            !media.sourceUrl ||
            !media.sourceAuthor ||
            !media.sourceAuthorUrl
          );
        })
        .map((candidate) => candidate.id);

      if (invalidAttributionCandidateIds.length > 0) {
        throw new BadRequestException(
          `Pexels 출처 정보가 누락된 후보가 있습니다: ${invalidAttributionCandidateIds.join(', ')}`,
        );
      }

      await tx.candidate.updateMany({
        where: { worldCupId, deletedAt: null },
        data: { visibleType: 'PUBLIC' },
      });

      await tx.worldCup.update({
        where: { id: worldCupId },
        data: { visibleType: 'PUBLIC' },
      });

      return {
        worldCupId: worldCup.id,
        title: worldCup.title,
        candidateCount: worldCup.candidates.length,
        status: 'PUBLIC' as const,
      };
    });
  }
}
