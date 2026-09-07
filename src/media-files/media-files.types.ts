import type {
  MediaDetailType,
  MediaFileType,
} from '../generated/prisma/enums.js';

export interface MediaFileResponse {
  mediaFileId: number;
  fileType: MediaFileType;
  mediaData: string;
  originalName: string | null;
  videoStartTime: string | null;
  videoPlayDuration: number | null;
  detailType: MediaDetailType;
  createdAt: Date;
  updatedAt: Date;
}
