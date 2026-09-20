import type { MediaFileResponse } from '../media-files/media-files.types.js';

export interface WorldCupListItem {
  worldCupId: number;
  title: string;
  description: string;
  contentsName1: string | null;
  mediaFileId1: number | null;
  mediaFile1?: MediaFileResponse;
  contentsName2: string | null;
  mediaFileId2: number | null;
  mediaFile2?: MediaFileResponse;
}

export interface WorldCupPage {
  totalElements: number;
  content: WorldCupListItem[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalPages: number;
}

export interface AvailableRounds {
  worldCupId: number;
  worldCupTitle: string;
  worldCupDescription: string;
  rounds: number[];
}

export interface WorldCupGameContent {
  fileType: 'STATIC_MEDIA_FILE';
  contentsId: number;
  name: string;
  mediaFileId: number | null;
  mediaFile?: MediaFileResponse;
  internetMovieStartPlayTime: null;
  videoPlayDuration: null;
}

export interface WorldCupContents {
  worldCupId: number;
  title: string;
  round: number;
  contentsList: WorldCupGameContent[];
}

export interface ClearWorldCupResultContent {
  contentsName: string;
  contentsId: number;
  mediaFileId: number | null;
  mediaFile?: MediaFileResponse;
  rank: number;
}

export interface WorldCupRankingContent {
  contentsId: number;
  contentsName: string;
  mediaFileId: number | null;
  mediaFile?: MediaFileResponse;
  gameRank: number;
  gameScore: number;
}
