// ============================================================
// Types and enums — no logic in this file.
// ============================================================

export type DifficultyKey = 'beginner' | 'intermediate' | 'expert';

export interface DifficultyConfig {
  rows: number;
  cols: number;
  mines: number;
}

/** Flat index: row * cols + col */
export type CellIndex = number;

export enum CellDisplayState {
  Hidden,
  Flagged,
  Question,
  Revealed,
}

export interface Cell {
  index: CellIndex;
  isMine: boolean;
  adjacentMines: number;   // 0–8; meaningful only when isMine is false
  displayState: CellDisplayState;
  isDetonated: boolean;    // the mine the player directly clicked
  isWrongFlag: boolean;    // flagged non-mine cell after loss
}

export enum GamePhase {
  Idle,   // no clicks yet
  Active, // first click made, timer running
  Won,
  Lost,
}

export interface GameState {
  difficulty: DifficultyKey;
  rows: number;
  cols: number;
  totalMines: number;
  cells: Cell[];
  phase: GamePhase;
  flagCount: number;        // mines remaining = totalMines - flagCount
  elapsedSeconds: number;
  revealedCount: number;    // win when === rows * cols - totalMines
}

export type InputAction =
  | { type: 'reveal'; index: CellIndex }
  | { type: 'flag';   index: CellIndex }
  | { type: 'chord';  index: CellIndex };
