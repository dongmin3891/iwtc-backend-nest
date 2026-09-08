import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsQuery } from './dto/list-comments.query.js';
import type { CommentListItem } from './comments.types.js';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    worldCupId: number,
    query: ListCommentsQuery,
  ): Promise<CommentListItem[]> {
    await this.ensurePublicWorldCup(worldCupId);

    const comments = await this.prisma.comment.findMany({
      where: {
        worldCupId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        memberId: true,
        nickname: true,
        body: true,
        createdAt: true,
      },
    });

    return comments.map((comment) => ({
      commentId: comment.id,
      commentWriterId: comment.memberId,
      writerNickname: comment.nickname,
      body: comment.body,
      createdAt: comment.createdAt,
    }));
  }

  async create(
    worldCupId: number,
    candidateId: number,
    request: CreateCommentDto,
  ): Promise<null> {
    await this.ensurePublicWorldCup(worldCupId);

    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        worldCupId,
        visibleType: 'PUBLIC',
      },
      select: { id: true },
    });
    if (!candidate) {
      throw new NotFoundException('월드컵 후보를 찾을 수 없습니다.');
    }

    await this.prisma.comment.create({
      data: {
        worldCupId,
        candidateId,
        memberId: null,
        nickname: request.nickname,
        body: request.body,
      },
    });

    return null;
  }

  private async ensurePublicWorldCup(worldCupId: number): Promise<void> {
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
  }
}
