import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ObjectStorageService } from '../media-files/object-storage.service.js';
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

interface DeletedMediaObject {
  objectKey: string | null;
  thumbnailObjectKey: string | null;
}

const STORAGE_DELETE_ATTEMPTS = 3;

@Injectable()
export class ManageWorldCupsService {
  private readonly logger = new Logger(ManageWorldCupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

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

  async update(
    memberId: number,
    worldCupId: number,
    request: CreateManagedWorldCupDto,
  ): Promise<void> {
    const worldCup = await this.prisma.worldCup.findFirst({
      where: { id: worldCupId, ownerId: memberId },
      select: { id: true },
    });

    if (!worldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    await this.prisma.worldCup.update({
      where: { id: worldCupId },
      data: {
        title: request.title,
        description: request.description ?? '',
        visibleType: request.visibleType,
      },
    });
  }

  async remove(memberId: number, worldCupId: number): Promise<void> {
    const deletedMediaObjects = await this.prisma.$transaction(
      async (transaction): Promise<DeletedMediaObject[]> => {
        const worldCup = await transaction.worldCup.findFirst({
          where: { id: worldCupId, ownerId: memberId },
          select: {
            id: true,
            candidates: { select: { mediaFileId: true } },
          },
        });
        if (!worldCup) {
          throw new NotFoundException('월드컵을 찾을 수 없습니다.');
        }

        const mediaFileIds = [
          ...new Set(
            worldCup.candidates
              .map((candidate) => candidate.mediaFileId)
              .filter((id): id is number => id !== null),
          ),
        ];

        await transaction.gamePlacement.deleteMany({
          where: { gamePlay: { worldCupId } },
        });
        await transaction.comment.deleteMany({ where: { worldCupId } });
        await transaction.gamePlay.deleteMany({ where: { worldCupId } });
        await transaction.candidate.deleteMany({ where: { worldCupId } });

        const orphanMediaFiles =
          mediaFileIds.length === 0
            ? []
            : await transaction.mediaFile.findMany({
                where: {
                  id: { in: mediaFileIds },
                  candidates: { none: {} },
                },
                select: {
                  id: true,
                  objectKey: true,
                  thumbnailObjectKey: true,
                },
              });

        if (orphanMediaFiles.length > 0) {
          await transaction.mediaFile.deleteMany({
            where: { id: { in: orphanMediaFiles.map((media) => media.id) } },
          });
        }

        const deletedWorldCup = await transaction.worldCup.deleteMany({
          where: { id: worldCupId, ownerId: memberId },
        });
        if (deletedWorldCup.count === 0) {
          throw new NotFoundException('월드컵을 찾을 수 없습니다.');
        }

        return orphanMediaFiles.map(({ objectKey, thumbnailObjectKey }) => ({
          objectKey,
          thumbnailObjectKey,
        }));
      },
    );

    const objectKeys = [
      ...new Set(
        deletedMediaObjects
          .flatMap(({ objectKey, thumbnailObjectKey }) => [
            objectKey,
            thumbnailObjectKey,
          ])
          .filter((key): key is string => key !== null),
      ),
    ];

    for (const objectKey of objectKeys) {
      await this.deleteStorageObjectWithRetry(objectKey);
    }
  }

  private async deleteStorageObjectWithRetry(objectKey: string): Promise<void> {
    for (let attempt = 1; attempt <= STORAGE_DELETE_ATTEMPTS; attempt += 1) {
      try {
        await this.objectStorage.deleteObject(objectKey);
        return;
      } catch (error) {
        if (attempt < STORAGE_DELETE_ATTEMPTS) {
          this.logger.warn(
            `월드컵 고아 미디어 객체 삭제 재시도 (${attempt}/${STORAGE_DELETE_ATTEMPTS}): ${objectKey}`,
          );
          continue;
        }

        this.logger.error(
          `월드컵 DB 삭제 후 미디어 객체 정리에 실패했습니다: ${objectKey}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
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
