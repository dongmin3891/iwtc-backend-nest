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

  it('uses the authenticated member instead of a supplied nickname', async () => {
    const create = vi.fn().mockResolvedValue({ id: 2 });
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      comment: { create },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    const request = new CreateCommentDto();
    request.body = '회원 댓글입니다';
    request.nickname = '위조닉네임';

    await expect(
      service.create(1, 3, request, {
        id: 7,
        serviceId: 'member01',
        nickname: '동민',
      }),
    ).resolves.toBeNull();
    expect(create).toHaveBeenCalledWith({
      data: {
        worldCupId: 1,
        candidateId: 3,
        memberId: 7,
        nickname: '동민',
        body: '회원 댓글입니다',
      },
    });
  });

  it('requires a nickname only for a guest comment', async () => {
    const create = vi.fn();
    const prisma = {
      worldCup: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      candidate: { findFirst: vi.fn().mockResolvedValue({ id: 3 }) },
      comment: { create },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);
    const request = new CreateCommentDto();
    request.body = '닉네임 없는 비회원 댓글';

    await expect(service.create(1, 3, request)).rejects.toMatchObject({
      status: 400,
      message: '비회원 댓글은 닉네임이 필요합니다.',
    });
    expect(create).not.toHaveBeenCalled();
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

  it('soft-deletes a comment owned by the authenticated member', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      comment: {
        findFirst: vi.fn().mockResolvedValue({ memberId: 7 }),
        updateMany,
      },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(service.remove(3, 7)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 3, memberId: 7, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects deletion by a member who does not own the comment', async () => {
    const updateMany = vi.fn();
    const prisma = {
      comment: {
        findFirst: vi.fn().mockResolvedValue({ memberId: 7 }),
        updateMany,
      },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(service.remove(3, 8)).rejects.toMatchObject({
      status: 403,
      message: '댓글 작성자만 삭제할 수 있습니다.',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects deletion of a guest comment', async () => {
    const updateMany = vi.fn();
    const prisma = {
      comment: {
        findFirst: vi.fn().mockResolvedValue({ memberId: null }),
        updateMany,
      },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(service.remove(1, 7)).rejects.toMatchObject({ status: 403 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects deletion of a missing or already deleted comment', async () => {
    const updateMany = vi.fn();
    const prisma = {
      comment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany,
      },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(service.remove(999, 7)).rejects.toMatchObject({ status: 404 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a concurrent repeated deletion', async () => {
    const prisma = {
      comment: {
        findFirst: vi.fn().mockResolvedValue({ memberId: 7 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const service = new CommentsService(prisma);

    await expect(service.remove(3, 7)).rejects.toMatchObject({ status: 404 });
  });
});
