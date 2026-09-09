import type { VisibilityType } from '../generated/prisma/enums.js';

export interface ManagedWorldCupSummary {
  worldCupId: number;
  title: string;
  description: string;
  visibleType: VisibilityType;
}

export interface ManagedWorldCupDetail extends ManagedWorldCupSummary {
  createdAt: Date;
  updatedAt: Date;
}
