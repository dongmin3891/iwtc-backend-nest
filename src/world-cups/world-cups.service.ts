import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetWorldCupContentsQuery } from './dto/get-world-cup-contents.query.js';
import { DateRange, ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import type {
  AvailableRounds,
  WorldCupContents,
  WorldCupGameContent,
  WorldCupPage,
} from './world-cups.types.js';

const SUPPORTED_ROUNDS = [2, 4, 8, 16, 32, 64, 128, 256] as const;

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
            where: { visibleType: 'PUBLIC' },
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
              where: { visibleType: 'PUBLIC' },
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
              where: { visibleType: 'PUBLIC' },
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
