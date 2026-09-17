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
  sourceProvider?: string | null;
  sourceExternalId?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  sourceAuthorUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
