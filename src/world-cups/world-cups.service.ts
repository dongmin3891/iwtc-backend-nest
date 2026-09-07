import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DateRange, ListWorldCupsQuery } from './dto/list-world-cups.query.js';
import type { WorldCupPage } from './world-cups.types.js';

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
}
