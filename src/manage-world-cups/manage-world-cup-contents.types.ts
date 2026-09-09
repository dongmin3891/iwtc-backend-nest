import type { VisibilityType } from '../generated/prisma/enums.js';

export interface ManagedWorldCupContent {
  contentsId: number;
  contentsName: string;
  mediaFileId: number | null;
  visibleType: VisibilityType;
  gameRank: number;
  gameScore: number;
}
