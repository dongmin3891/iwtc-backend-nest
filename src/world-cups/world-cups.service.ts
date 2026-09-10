import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClearWorldCupDto } from './dto/clear-world-cup.dto.js';
import { GetWorldCupContentsQuery } from './dto/get-world-cup-contents.query.js';
import { DateRange, ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import { SUPPORTED_ROUNDS } from './world-cups.constants.js';
import type {
  AvailableRounds,
  ClearWorldCupResultContent,
  WorldCupContents,
  WorldCupGameContent,
  WorldCupPage,
  WorldCupRankingContent,
} from './world-cups.types.js';

const GAME_RESULT_SELECT = {
  id: true,
  worldCupId: true,
  initialRound: true,
  placements: {
    orderBy: { rank: 'asc' },
    select: {
      rank: true,
      candidate: {
        select: {
          id: true,
          name: true,
          mediaFileId: true,
        },
      },
    },
  },
} satisfies Prisma.GamePlaySelect;

type SavedGameResult = Prisma.GamePlayGetPayload<{
  select: typeof GAME_RESULT_SELECT;
}>;

@Injectable()
export class WorldCupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListWorldCupsQuery): Promise<WorldCupPage> {
    const where: Prisma.WorldCupWhereInput = {
      visibleType: 'PUBLIC',
      ...(query.keyword
        ? { title: { contains: query.keyword, mode: 'insensitive' } }
        : {}),
      ...(query.memberId ? { ownerId: query.memberId } : {}),
      ...this.createdAtFilter(query.dateRange),
    };
    const orderBy: Prisma.WorldCupOrderByWithRelationInput =
      query.sort === 'views,DESC' ? { views: 'desc' } : { id: 'desc' };

    const [totalElements, worldCups] = await this.prisma.$transaction([
      this.prisma.worldCup.count({ where }),
      this.prisma.worldCup.findMany({
        where,
        orderBy,
        skip: query.page * query.size,
        take: query.size,
        include: {
          candidates: {
            where: { visibleType: 'PUBLIC', deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: 2,
          },
        },
      }),
    ]);

    return {
      totalElements,
      content: worldCups.map((worldCup) => ({
        worldCupId: worldCup.id,
        title: worldCup.title,
        description: worldCup.description,
        contentsName1: worldCup.candidates[0]?.name ?? null,
        mediaFileId1: worldCup.candidates[0]?.mediaFileId ?? null,
        contentsName2: worldCup.candidates[1]?.name ?? null,
        mediaFileId2: worldCup.candidates[1]?.mediaFileId ?? null,
      })),
      pageable: {
        pageNumber: query.page,
        pageSize: query.size,
      },
      totalPages: Math.ceil(totalElements / query.size),
    };
  }

  async findAvailableRounds(worldCupId: number): Promise<AvailableRounds> {
    const worldCup = await this.prisma.worldCup.findFirst({
      where: {
        id: worldCupId,
        visibleType: 'PUBLIC',
      },
      select: {
        id: true,
        title: true,
        description: true,
        _count: {
          select: {
            candidates: {
              where: { visibleType: 'PUBLIC', deletedAt: null },
            },
          },
        },
      },
    });

    if (!worldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    const rounds = SUPPORTED_ROUNDS.filter(
      (round) => round <= worldCup._count.candidates,
    );
    if (rounds.length === 0) {
      throw new BadRequestException('플레이 가능한 콘텐츠가 부족합니다.');
    }

    return {
      worldCupId: worldCup.id,
      worldCupTitle: worldCup.title,
      worldCupDescription: worldCup.description,
      rounds,
    };
  }

  async findContents(
    worldCupId: number,
    query: GetWorldCupContentsQuery,
  ): Promise<WorldCupContents> {
    const worldCup = await this.prisma.worldCup.findFirst({
      where: {
        id: worldCupId,
        visibleType: 'PUBLIC',
      },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            candidates: {
              where: { visibleType: 'PUBLIC', deletedAt: null },
            },
          },
        },
      },
    });

    if (!worldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }
    if (worldCup._count.candidates < query.currentRound) {
      throw new BadRequestException('요청한 라운드의 콘텐츠가 부족합니다.');
    }

    const contentsCount = query.currentRound / query.sliceContents;
    if (!Number.isInteger(contentsCount)) {
      throw new BadRequestException(
        '현재 라운드는 요청 횟수로 나누어 떨어져야 합니다.',
      );
    }

    const candidates = await this.prisma.candidate.findMany({
      where: {
        worldCupId,
        visibleType: 'PUBLIC',
        deletedAt: null,
        ...(query.excludeContentsIds.length > 0
          ? { id: { notIn: query.excludeContentsIds } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        mediaFileId: true,
      },
    });

    if (candidates.length < contentsCount) {
      throw new BadRequestException('조회할 수 있는 콘텐츠가 부족합니다.');
    }

    const contentsList: WorldCupGameContent[] = this.shuffle(candidates)
      .slice(0, contentsCount)
      .map((candidate) => ({
        fileType: 'STATIC_MEDIA_FILE',
        contentsId: candidate.id,
        name: candidate.name,
        mediaFileId: candidate.mediaFileId,
        internetMovieStartPlayTime: null,
        videoPlayDuration: null,
      }));

    return {
      worldCupId: worldCup.id,
      title: worldCup.title,
      round: query.currentRound,
      contentsList,
    };
  }

  async saveGameResult(
    worldCupId: number,
    request: ClearWorldCupDto,
  ): Promise<ClearWorldCupResultContent[]> {
    let savedPlay: SavedGameResult;
    try {
      savedPlay = await this.prisma.$transaction(async (transaction) => {
        const existingPlay = await transaction.gamePlay.findUnique({
          where: { id: request.playId },
          select: GAME_RESULT_SELECT,
        });
        if (existingPlay) {
          this.assertSameGameResult(existingPlay, worldCupId, request);
          return existingPlay;
        }

        const worldCup = await transaction.worldCup.findFirst({
          where: {
            id: worldCupId,
            visibleType: 'PUBLIC',
          },
          select: { id: true },
        });
        if (!worldCup) {
          throw new NotFoundException('월드컵을 찾을 수 없습니다.');
        }

        const candidateIds = request.placements.map(
          (placement) => placement.contentsId,
        );
        const candidates = await transaction.candidate.findMany({
          where: {
            id: { in: candidateIds },
            worldCupId,
            visibleType: 'PUBLIC',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (candidates.length !== candidateIds.length) {
          throw new BadRequestException(
            '결과 후보는 모두 해당 월드컵의 공개 후보여야 합니다.',
          );
        }

        return transaction.gamePlay.create({
          data: {
            id: request.playId,
            worldCupId,
            initialRound: request.round,
            completedAt: new Date(),
            placements: {
              create: request.placements.map((placement) => ({
                candidateId: placement.contentsId,
                rank: placement.rank,
                score: this.scoreForRank(placement.rank),
              })),
            },
          },
          select: GAME_RESULT_SELECT,
        });
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existingPlay = await this.prisma.gamePlay.findUnique({
        where: { id: request.playId },
        select: GAME_RESULT_SELECT,
      });
      if (!existingPlay) {
        throw error;
      }
      this.assertSameGameResult(existingPlay, worldCupId, request);
      savedPlay = existingPlay;
    }

    return this.toClearWorldCupResult(savedPlay);
  }

  async findGameResultContents(
    worldCupId: number,
  ): Promise<WorldCupRankingContent[]> {
    const worldCup = await this.prisma.worldCup.findFirst({
      where: {
        id: worldCupId,
        visibleType: 'PUBLIC',
      },
      select: { id: true },
    });
    if (!worldCup) {
      throw new NotFoundException('월드컵을 찾을 수 없습니다.');
    }

    const candidates = await this.prisma.candidate.findMany({
      where: {
        worldCupId,
        visibleType: 'PUBLIC',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        mediaFileId: true,
      },
    });
    const scoreGroups = await this.prisma.gamePlacement.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: candidates.map(({ id }) => id) } },
      _sum: { score: true },
    });
    const scores = new Map(
      scoreGroups.map((group) => [group.candidateId, group._sum.score ?? 0]),
    );
    const sortedCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        gameScore: scores.get(candidate.id) ?? 0,
      }))
      .sort(
        (left, right) => right.gameScore - left.gameScore || left.id - right.id,
      );

    let previousScore: number | undefined;
    let previousRank = 0;
    return sortedCandidates.map((candidate, index) => {
      const gameRank =
        candidate.gameScore === previousScore ? previousRank : index + 1;
      previousScore = candidate.gameScore;
      previousRank = gameRank;
      return {
        contentsId: candidate.id,
        contentsName: candidate.name,
        mediaFileId: candidate.mediaFileId,
        gameRank,
        gameScore: candidate.gameScore,
      };
    });
  }

  private toClearWorldCupResult(
    savedPlay: SavedGameResult,
  ): ClearWorldCupResultContent[] {
    return savedPlay.placements.map((placement) => ({
      contentsName: placement.candidate.name,
      contentsId: placement.candidate.id,
      mediaFileId: placement.candidate.mediaFileId,
      rank: placement.rank,
    }));
  }

  private assertSameGameResult(
    savedPlay: SavedGameResult,
    worldCupId: number,
    request: ClearWorldCupDto,
  ): void {
    const isSameResult =
      savedPlay.worldCupId === worldCupId &&
      savedPlay.initialRound === request.round &&
      savedPlay.placements.length === request.placements.length &&
      request.placements.every((requestedPlacement) =>
        savedPlay.placements.some(
          (savedPlacement) =>
            savedPlacement.rank === requestedPlacement.rank &&
            savedPlacement.candidate.id === requestedPlacement.contentsId,
        ),
      );

    if (!isSameResult) {
      throw new ConflictException('이미 다른 결과에 사용된 playId입니다.');
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private createdAtFilter(
    dateRange: DateRange,
  ): Pick<Prisma.WorldCupWhereInput, 'createdAt'> {
    if (dateRange === DateRange.ALL) {
      return {};
    }

    const start = new Date();
    if (dateRange === DateRange.YEAR) {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
    } else if (dateRange === DateRange.MONTH) {
      start.setUTCMonth(start.getUTCMonth() - 1);
    } else {
      start.setUTCDate(start.getUTCDate() - 1);
    }

    return { createdAt: { gte: start } };
  }

  private scoreForRank(rank: number): number {
    if (rank === 1) {
      return 10;
    }
    if (rank === 2) {
      return 7;
    }
    return 4;
  }

  private shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }
}
