import type { PrismaService } from '../prisma/prisma.service.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsQuery } from './dto/list-comments.query.js';

describe('CommentsService', () => {
  it('returns visible comments in a stable newest-first page', async () => {
    const createdAt = new Date('2026-09-08T00:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 2,
        memberId: null,
        nickname: 'guest-a1',
        body: '재미있어요',
        createdAt,
      },
    ]);
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      comment: { findMany },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    const query = new ListCommentsQuery();
    query.offset = 10;
    query.limit = 5;

    await expect(service.findAll(1, query)).resolves.toEqual([
      {
        commentId: 2,
        commentWriterId: null,
        writerNickname: 'guest-a1',
        body: '재미있어요',
        createdAt,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { worldCupId: 1, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 5,
      select: {
        id: true,
        memberId: true,
        nickname: true,
        body: true,
        createdAt: true,
      },
    });
  });

  it('creates a guest comment for a public candidate in the world cup', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      comment: { create },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    const request = new CreateCommentDto();
    request.body = '후보가 마음에 들어요';
    request.nickname = 'guest-b2';

    await expect(service.create(1, 3, request)).resolves.toBeNull();
    expect(create).toHaveBeenCalledWith({
      data: {
        worldCupId: 1,
        candidateId: 3,
        memberId: null,
        nickname: 'guest-b2',
        body: '후보가 마음에 들어요',
      },
    });
  });

  it('rejects comments for an unknown world cup', async () => {
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue(null) },
      comment: { findMany: vi.fn() },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(
      service.findAll(999, new ListCommentsQuery()),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a candidate that does not belong to the world cup', async () => {
    const create = vi.fn();
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findFirst: vi.fn().mockResolvedValue(null) },
      comment: { create },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    const request = new CreateCommentDto();
    request.body = '댓글';
    request.nickname = 'guest-c3';

    await expect(service.create(1, 999, request)).rejects.toMatchObject({
      status: 404,
    });
    expect(create).not.toHaveBeenCalled();
  });
});
