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
