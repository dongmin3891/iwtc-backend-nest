import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { CreateWorldCupContentsDto } from './dto/create-world-cup-contents.dto.js';
import type { UpdateWorldCupContentsDto } from './dto/update-world-cup-contents.dto.js';
import { ManageWorldCupContentsController } from './manage-world-cup-contents.controller.js';
import type { ManageWorldCupContentsService } from './manage-world-cup-contents.service.js';

function authenticatedRequest(): Request & AuthenticatedRequest {
  return {
    member: {
      id: 7,
      serviceId: 'member7',
      nickname: '회원7',
    },
  } as Request & AuthenticatedRequest;
}

function createRequest(): CreateWorldCupContentsDto {
  return {
    data: [
      {
        contentsName: '후보 A',
        visibleType: 'PRIVATE',
        createMediaFileRequest: {
          fileType: 'INTERNET_VIDEO_URL',
          mediaData: 'https://www.youtube.com/watch?v=video-a',
          videoStartTime: '00030',
          videoPlayDuration: 3,
          detailFileType: 'YOU_TUBE_URL',
        },
      },
      {
        contentsName: '후보 B',
        visibleType: 'PUBLIC',
        createMediaFileRequest: {
          fileType: 'INTERNET_VIDEO_URL',
          mediaData: 'https://www.youtube.com/watch?v=video-b',
          videoStartTime: '00045',
          videoPlayDuration: 5,
          detailFileType: 'YOU_TUBE_URL',
        },
      },
    ],
  };
}

function updateRequest(): UpdateWorldCupContentsDto {
  return {
    contentsName: '수정 후보',
    originalName: 'ignored-name',
    mediaData: 'https://www.youtube.com/watch?v=updated-video',
    detailFileType: 'YOU_TUBE_URL',
    videoStartTime: '00120',
    videoPlayDuration: 5,
    visibleType: 'PUBLIC',
  };
}

describe('ManageWorldCupContentsController', () => {
  it('returns the created static image candidate id', async () => {
    const createStaticImage = vi.fn().mockResolvedValue(15);
    const controller = new ManageWorldCupContentsController({
      createStaticImage,
    } as unknown as ManageWorldCupContentsService);
    const body = {
      contentsName: '이미지 후보',
      visibleType: 'PUBLIC',
    } as const;
    const file = {
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      originalname: 'candidate.jpg',
      size: 3,
    };

    await expect(
      controller.createStatic(3, body, file, authenticatedRequest()),
    ).resolves.toEqual({
      code: 1,
      message: '이미지 후보 생성',
      data: 15,
    });
    expect(createStaticImage).toHaveBeenCalledWith(7, 3, body, file);
  });

  it('passes the authenticated member and validated candidate array to the service', async () => {
    const createMany = vi.fn().mockResolvedValue([11, 12]);
    const controller = new ManageWorldCupContentsController({
      createMany,
    } as unknown as ManageWorldCupContentsService);
    const body = createRequest();

    await expect(
      controller.create(3, body, authenticatedRequest()),
    ).resolves.toEqual({
      code: 1,
      message: '게임 생성',
      data: null,
    });
    expect(createMany).toHaveBeenCalledWith(7, 3, body.data);
  });

  it('does not return a success response when candidate storage fails', async () => {
    const storageError = new Error('candidate storage failed');
    const createMany = vi.fn().mockRejectedValue(storageError);
    const controller = new ManageWorldCupContentsController({
      createMany,
    } as unknown as ManageWorldCupContentsService);

    await expect(
      controller.create(3, createRequest(), authenticatedRequest()),
    ).rejects.toBe(storageError);
  });

  it('passes the authenticated member and candidate update to the service', async () => {
    const updateOne = vi.fn().mockResolvedValue(15);
    const controller = new ManageWorldCupContentsController({
      updateOne,
    } as unknown as ManageWorldCupContentsService);
    const body = updateRequest();

    await expect(
      controller.update(3, 15, body, authenticatedRequest()),
    ).resolves.toBeUndefined();
    expect(updateOne).toHaveBeenCalledWith(7, 3, 15, body);
  });

  it('does not complete when candidate update fails', async () => {
    const updateError = new Error('candidate update failed');
    const updateOne = vi.fn().mockRejectedValue(updateError);
    const controller = new ManageWorldCupContentsController({
      updateOne,
    } as unknown as ManageWorldCupContentsService);

    await expect(
      controller.update(3, 15, updateRequest(), authenticatedRequest()),
    ).rejects.toBe(updateError);
  });

  it('passes the authenticated member and candidate deletion to the service', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const controller = new ManageWorldCupContentsController({
      remove,
    } as unknown as ManageWorldCupContentsService);

    await expect(
      controller.remove(3, 15, authenticatedRequest()),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(7, 3, 15);
  });

  it('does not complete when candidate deletion fails', async () => {
    const deleteError = new Error('candidate deletion failed');
    const remove = vi.fn().mockRejectedValue(deleteError);
    const controller = new ManageWorldCupContentsController({
      remove,
    } as unknown as ManageWorldCupContentsService);

    await expect(controller.remove(3, 15, authenticatedRequest())).rejects.toBe(
      deleteError,
    );
  });
});
