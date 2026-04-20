import type { DifficultyKey, DifficultyConfig } from './types';

export const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  beginner:     { rows:  9, cols:  9, mines:  10 },
  intermediate: { rows: 16, cols: 16, mines:  40 },
  expert:       { rows: 16, cols: 30, mines:  99 },
};
