import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { CreateWorldCupContentsDto } from './dto/create-world-cup-contents.dto.js';
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

describe('ManageWorldCupContentsController', () => {
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
});
