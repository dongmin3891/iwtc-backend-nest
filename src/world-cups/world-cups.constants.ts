export const SUPPORTED_ROUNDS = [2, 4, 8, 16, 32, 64, 128, 256] as const;

export type SupportedRound = (typeof SUPPORTED_ROUNDS)[number];
