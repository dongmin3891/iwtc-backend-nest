export interface WorldCupListItem {
  worldCupId: number;
  title: string;
  description: string;
  contentsName1: string | null;
  mediaFileId1: number | null;
  contentsName2: string | null;
  mediaFileId2: number | null;
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
  internetMovieStartPlayTime: null;
  videoPlayDuration: null;
}

export interface WorldCupContents {
  worldCupId: number;
  title: string;
  round: number;
  contentsList: WorldCupGameContent[];
}
