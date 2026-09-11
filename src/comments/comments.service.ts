import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MemberSummary } from '../auth/auth.types.js';
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
    member?: MemberSummary,
  ): Promise<null> {
    await this.ensurePublicWorldCup(worldCupId);

    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        worldCupId,
        visibleType: 'PUBLIC',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!candidate) {
      throw new NotFoundException('월드컵 후보를 찾을 수 없습니다.');
    }

    const nickname = member?.nickname ?? request.nickname;
    if (!nickname) {
      throw new BadRequestException('비회원 댓글은 닉네임이 필요합니다.');
    }

    await this.prisma.comment.create({
      data: {
        worldCupId,
        candidateId,
        memberId: member?.id ?? null,
        nickname,
        body: request.body,
      },
    });

    return null;
  }

  async remove(commentId: number, memberId: number): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
      },
      select: { memberId: true },
    });
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    if (comment.memberId !== memberId) {
      throw new ForbiddenException('댓글 작성자만 삭제할 수 있습니다.');
    }

    const result = await this.prisma.comment.updateMany({
      where: {
        id: commentId,
        memberId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
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
