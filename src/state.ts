// ============================================================
// Pure state-transition functions — no DOM, no side-effects.
// ============================================================

import { DIFFICULTIES } from './config';
import {
  type DifficultyKey,
  type CellIndex,
  type GameState,
  type Cell,
  CellDisplayState,
  GamePhase,
} from './types';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function neighbors(index: CellIndex, rows: number, cols: number): CellIndex[] {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const result: CellIndex[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        result.push(nr * cols + nc);
      }
    }
  }
  return result;
}

function shallowCopyCells(cells: Cell[]): Cell[] {
  return cells.map(c => ({ ...c }));
}

// ------------------------------------------------------------
// createGame
// ------------------------------------------------------------

export function createGame(difficulty: DifficultyKey): GameState {
  const cfg = DIFFICULTIES[difficulty];
  const total = cfg.rows * cfg.cols;
  const cells: Cell[] = Array.from({ length: total }, (_, i) => ({
    index: i,
    isMine: false,
    adjacentMines: 0,
    displayState: CellDisplayState.Hidden,
    isDetonated: false,
    isWrongFlag: false,
  }));

  return {
    difficulty,
    rows: cfg.rows,
    cols: cfg.cols,
    totalMines: cfg.mines,
    cells,
    phase: GamePhase.Idle,
    flagCount: 0,
    elapsedSeconds: 0,
    revealedCount: 0,
  };
}

// ------------------------------------------------------------
// placeMines — called on first click, never place a mine on firstClick cell
// ------------------------------------------------------------

export function placeMines(state: GameState, firstClick: CellIndex): GameState {
  const { rows, cols, totalMines } = state;
  const total = rows * cols;
  const cells = shallowCopyCells(state.cells);

  // Fisher-Yates shuffle over valid indices (exclude firstClick)
  const indices = Array.from({ length: total }, (_, i) => i).filter(i => i !== firstClick);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Place mines
  for (let m = 0; m < totalMines; m++) {
    cells[indices[m]].isMine = true;
  }

  // Compute adjacent counts
  for (let i = 0; i < total; i++) {
    if (cells[i].isMine) continue;
    let count = 0;
    for (const n of neighbors(i, rows, cols)) {
      if (cells[n].isMine) count++;
    }
    cells[i].adjacentMines = count;
  }

  return { ...state, cells, phase: GamePhase.Active };
}

// ------------------------------------------------------------
// revealCell — with iterative flood-fill for zero-count cells
// ------------------------------------------------------------

export function revealCell(state: GameState, index: CellIndex): GameState {
  const { rows, cols } = state;
  const cells = shallowCopyCells(state.cells);
  const cell = cells[index];

  // Only reveal hidden, unflagged cells
  if (cell.displayState !== CellDisplayState.Hidden) return state;

  // Reveal mine → loss
  if (cell.isMine) {
    cell.displayState = CellDisplayState.Revealed;
    cell.isDetonated = true;

    // Reveal all mine locations and mark wrong flags
    for (const c of cells) {
      if (c.isMine && !c.isDetonated) {
        c.displayState = CellDisplayState.Revealed;
      }
      if (!c.isMine && c.displayState === CellDisplayState.Flagged) {
        c.isWrongFlag = true;
      }
    }

    return { ...state, cells, phase: GamePhase.Lost };
  }

  // Iterative flood fill
  let revealed = state.revealedCount;
  const queue: CellIndex[] = [index];
  const visited = new Set<CellIndex>();
  visited.add(index);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curCell = cells[cur];

    if (curCell.displayState === CellDisplayState.Hidden) {
      curCell.displayState = CellDisplayState.Revealed;
      revealed++;
    }

    if (curCell.adjacentMines === 0 && !curCell.isMine) {
      for (const nb of neighbors(cur, rows, cols)) {
        if (!visited.has(nb)) {
          const nbCell = cells[nb];
          if (
            !nbCell.isMine &&
            nbCell.displayState === CellDisplayState.Hidden
          ) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
    }
  }

  const next: GameState = { ...state, cells, revealedCount: revealed };
  return checkWin(next);
}

// ------------------------------------------------------------
// cycleFlag
// ------------------------------------------------------------

export function cycleFlag(state: GameState, index: CellIndex): GameState {
  const cells = shallowCopyCells(state.cells);
  const cell = cells[index];

  if (cell.displayState === CellDisplayState.Revealed) return state;

  let flagCount = state.flagCount;

  if (cell.displayState === CellDisplayState.Hidden) {
    cell.displayState = CellDisplayState.Flagged;
    flagCount++;
  } else if (cell.displayState === CellDisplayState.Flagged) {
    cell.displayState = CellDisplayState.Question;
    flagCount--;
  } else if (cell.displayState === CellDisplayState.Question) {
    cell.displayState = CellDisplayState.Hidden;
  }

  return { ...state, cells, flagCount };
}

// ------------------------------------------------------------
// chord — reveal all adjacent unrevealed unflagged cells
// ------------------------------------------------------------

export function chord(state: GameState, index: CellIndex): GameState {
  const { rows, cols } = state;
  const cell = state.cells[index];

  // Only chord on revealed numbered cells
  if (cell.displayState !== CellDisplayState.Revealed) return state;
  if (cell.isMine) return state;
  if (cell.adjacentMines === 0) return state;

  const nbs = neighbors(index, rows, cols);

  // Count adjacent flags
  const flagged = nbs.filter(
    n => state.cells[n].displayState === CellDisplayState.Flagged
  ).length;

  if (flagged !== cell.adjacentMines) return state;

  // Clone cells once and apply all reveals against the working copy to avoid
  // O(N*neighbors) array allocation from chaining individual revealCell calls.
  const cells = shallowCopyCells(state.cells);
  let working: GameState = { ...state, cells };
  for (const nb of nbs) {
    if (working.cells[nb].displayState === CellDisplayState.Hidden) {
      working = revealCell(working, nb);
      if (working.phase === GamePhase.Lost) return working;
    }
  }

  return working;
}

// ------------------------------------------------------------
// checkWin
// ------------------------------------------------------------

export function checkWin(state: GameState): GameState {
  const target = state.rows * state.cols - state.totalMines;
  if (state.revealedCount < target) return state;

  // Auto-flag unflagged mines
  const cells = shallowCopyCells(state.cells);
  let flagCount = state.flagCount;
  for (const c of cells) {
    if (c.isMine && c.displayState !== CellDisplayState.Flagged) {
      c.displayState = CellDisplayState.Flagged;
      flagCount++;
    }
  }

  return { ...state, cells, flagCount, phase: GamePhase.Won };
}
