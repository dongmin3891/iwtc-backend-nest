import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateManagedWorldCupDto } from './dto/create-managed-world-cup.dto.js';
import type {
  ManagedWorldCupDetail,
  ManagedWorldCupSummary,
} from './manage-world-cups.types.js';

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
}
