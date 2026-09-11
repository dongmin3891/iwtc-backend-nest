import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorldCupContentDto } from './dto/create-world-cup-contents.dto.js';
import type { UpdateWorldCupContentsDto } from './dto/update-world-cup-contents.dto.js';
import type { ManagedWorldCupContent } from './manage-world-cup-contents.types.js';

const CANDIDATE_ORDER_LOCK_NAMESPACE = 0x49575443;

@Injectable()
export class ManageWorldCupContentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOne(
    memberId: number,
    worldCupId: number,
    request: CreateWorldCupContentDto,
  ): Promise<number> {
    const candidateIds = await this.createMany(memberId, worldCupId, [request]);

    return candidateIds[0]!;
  }

  async createMany(
    memberId: number,
    worldCupId: number,
    requests: CreateWorldCupContentDto[],
  ): Promise<number[]> {
    return this.prisma.$transaction(async (transaction) => {
      const ownedWorldCup = await transaction.worldCup.findFirst({
        where: { id: worldCupId, ownerId: memberId },
        select: { id: true },
      });
      if (!ownedWorldCup) {
        throw new NotFoundException('월드컵을 찾을 수 없습니다.');
      }

      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          CAST(${CANDIDATE_ORDER_LOCK_NAMESPACE} AS INTEGER),
          CAST(${worldCupId} AS INTEGER)
        ) IS NULL AS "locked"
      `;

      const lastCandidate = await transaction.candidate.findFirst({
        where: { worldCupId },
        orderBy: [{ sortOrder: 'desc' }, { id: 'desc' }],
        select: { sortOrder: true },
      });

      const firstSortOrder = (lastCandidate?.sortOrder ?? -1) + 1;
      const candidateIds: number[] = [];
      for (const [index, request] of requests.entries()) {
        const candidateId = await this.createCandidate(
          transaction,
          worldCupId,
          request,
          firstSortOrder + index,
        );
        candidateIds.push(candidateId);
      }

      return candidateIds;
    });
  }

  private async createCandidate(
    transaction: Prisma.TransactionClient,
    worldCupId: number,
    request: CreateWorldCupContentDto,
    sortOrder: number,
  ): Promise<number> {
    const media = request.createMediaFileRequest;
    const mediaFile = await transaction.mediaFile.create({
      data: {
        fileType: media.fileType,
        detailType: media.detailFileType,
        objectKey: null,
        thumbnailObjectKey: null,
        externalUrl: media.mediaData,
        originalName: null,
        videoStartTime: media.videoStartTime,
        videoPlayDuration: media.videoPlayDuration,
      },
      select: { id: true },
    });
    const candidate = await transaction.candidate.create({
      data: {
        worldCupId,
        name: request.contentsName,
        mediaFileId: mediaFile.id,
        visibleType: request.visibleType,
        sortOrder,
      },
      select: { id: true },
    });

    return candidate.id;
  }

  async updateOne(
    memberId: number,
    worldCupId: number,
    contentsId: number,
    request: UpdateWorldCupContentsDto,
  ): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const ownedWorldCup = await transaction.worldCup.findFirst({
        where: { id: worldCupId, ownerId: memberId },
        select: { id: true },
      });
      if (!ownedWorldCup) {
        throw new NotFoundException('월드컵을 찾을 수 없습니다.');
      }

      const candidate = await transaction.candidate.findFirst({
        where: { id: contentsId, worldCupId, deletedAt: null },
        select: { id: true, mediaFileId: true },
      });
      if (!candidate) {
        throw new NotFoundException('월드컵 후보를 찾을 수 없습니다.');
      }
      if (candidate.mediaFileId === null) {
        throw new NotFoundException('미디어 파일을 찾을 수 없습니다.');
      }

      await transaction.mediaFile.update({
        where: { id: candidate.mediaFileId },
        data: {
          fileType: 'INTERNET_VIDEO_URL',
          detailType: request.detailFileType,
          objectKey: null,
          thumbnailObjectKey: null,
          externalUrl: request.mediaData,
          originalName: null,
          videoStartTime: request.videoStartTime,
          videoPlayDuration: request.videoPlayDuration,
        },
      });
      const updateResult = await transaction.candidate.updateMany({
        where: { id: candidate.id, worldCupId, deletedAt: null },
        data: {
          name: request.contentsName,
          visibleType: request.visibleType,
        },
      });
      if (updateResult.count === 0) {
        throw new NotFoundException('월드컵 후보를 찾을 수 없습니다.');
      }

      return candidate.id;
    });
  }

  async remove(
    memberId: number,
    worldCupId: number,
    contentsId: number,
  ): Promise<void> {
    const ownedWorldCup = await this.prisma.worldCup.findFirst({
      where: { id: worldCupId, ownerId: memberId },
      select: { id: true },
    });
    if (!ownedWorldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    const result = await this.prisma.candidate.updateMany({
      where: { id: contentsId, worldCupId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('월드컵 후보를 찾을 수 없습니다.');
    }
  }

  async findAll(
    memberId: number,
    worldCupId: number,
  ): Promise<ManagedWorldCupContent[]> {
    const ownedWorldCup = await this.prisma.worldCup.findFirst({
      where: { id: worldCupId, ownerId: memberId },
      select: { id: true },
    });
    if (!ownedWorldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    const candidates = await this.prisma.candidate.findMany({
      where: { worldCupId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        mediaFileId: true,
        visibleType: true,
      },
    });
    if (candidates.length === 0) {
      return [];
    }

    const scoreGroups = await this.prisma.gamePlacement.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidates.map(({ id }) => id) } },
      _sum: { score: true },
    });
    const scores = new Map(
      scoreGroups.map((group) => [group.candidateId, group._sum.score ?? 0]),
    );
    const rankedCandidates = [...candidates]
      .map((candidate) => ({
        id: candidate.id,
        gameScore: scores.get(candidate.id) ?? 0,
      }))
      .sort(
        (left, right) => right.gameScore - left.gameScore || left.id - right.id,
      );

    let previousScore: number | undefined;
    let previousRank = 0;
    const ranks = new Map<number, number>();
    rankedCandidates.forEach((candidate, index) => {
      const gameRank =
        candidate.gameScore === previousScore ? previousRank : index + 1;
      previousScore = candidate.gameScore;
      previousRank = gameRank;
      ranks.set(candidate.id, gameRank);
    });

    return candidates.map((candidate) => ({
      contentsId: candidate.id,
      contentsName: candidate.name,
      mediaFileId: candidate.mediaFileId,
      visibleType: candidate.visibleType,
      gameRank: ranks.get(candidate.id) ?? 0,
      gameScore: scores.get(candidate.id) ?? 0,
    }));
  }
}
