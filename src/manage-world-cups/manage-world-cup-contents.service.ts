import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ManagedWorldCupContent } from './manage-world-cup-contents.types.js';

@Injectable()
export class ManageWorldCupContentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { worldCupId },
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
