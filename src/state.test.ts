import { describe, it, expect } from 'vitest';
import {
  createGame,
  placeMines,
  revealCell,
  cycleFlag,
  chord,
  checkWin,
} from './state';
import { CellDisplayState, GamePhase } from './types';
import { formatTime } from './utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function startedGame(difficulty: 'beginner' | 'intermediate' | 'expert' = 'beginner', firstClick = 0) {
  const state = createGame(difficulty);
  return placeMines(state, firstClick);
}

// ─── SC2: first click never reveals a mine ────────────────────────────────────

describe('placeMines — first-click safety (SC2)', () => {
  const difficulties = ['beginner', 'intermediate', 'expert'] as const;

  for (const diff of difficulties) {
    it(`never places a mine on the clicked cell — ${diff}`, () => {
      for (let trial = 0; trial < 20; trial++) {
        const state = createGame(diff);
        const clickIndex = Math.floor(Math.random() * state.cells.length);
        const after = placeMines(state, clickIndex);
        expect(after.cells[clickIndex].isMine).toBe(false);
      }
    });
  }

  it('places exactly the right mine count', () => {
    const state = startedGame('beginner', 0);
    const mineCount = state.cells.filter(c => c.isMine).length;
    expect(mineCount).toBe(10);
  });

  it('transitions phase to Active', () => {
    const state = startedGame();
    expect(state.phase).toBe(GamePhase.Active);
  });
});

// ─── SC3: flood fill reveals expected region ──────────────────────────────────

describe('revealCell — flood fill (SC3)', () => {
  it('reveals a single numbered cell without spreading', () => {
    const state = createGame('beginner');
    // Manually set up a simple scenario: cell 0 has 1 adjacent mine, cell 1 is a mine
    const cells = state.cells.map(c => ({ ...c }));
    cells[1].isMine = true;
    cells[0].adjacentMines = 1;
    const after = revealCell({ ...state, cells, phase: GamePhase.Active }, 0);
    expect(after.cells[0].displayState).toBe(CellDisplayState.Revealed);
    expect(after.revealedCount).toBe(1);
    // Only the clicked cell should be revealed
    const revealedCount = after.cells.filter(c => c.displayState === CellDisplayState.Revealed).length;
    expect(revealedCount).toBe(1);
  });

  it('flood-fills a zero-count region and its numeric border', () => {
    // 3×3 board, no mines — every cell adjacentMines = 0
    // All cells should be revealed from a single click
    const state = createGame('beginner');
    // Override to a clean 3×3 with no mines for predictable flood fill
    const cells = state.cells.map(c => ({ ...c, isMine: false, adjacentMines: 0 }));
    const small: typeof state = { ...state, rows: 3, cols: 3, totalMines: 0, cells: cells.slice(0, 9), phase: GamePhase.Active };
    const after = revealCell(small, 4); // center cell
    const revealed = after.cells.filter(c => c.displayState === CellDisplayState.Revealed).length;
    expect(revealed).toBe(9);
  });

  it('does not reveal flagged neighbors during flood fill', () => {
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c, isMine: false, adjacentMines: 0 }));
    cells[1].displayState = CellDisplayState.Flagged;
    const small: typeof state = { ...state, rows: 3, cols: 3, totalMines: 0, cells: cells.slice(0, 9), phase: GamePhase.Active };
    const after = revealCell(small, 4);
    expect(after.cells[1].displayState).toBe(CellDisplayState.Flagged);
  });

  it('triggers loss when revealing a mine', () => {
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c }));
    cells[5].isMine = true;
    const after = revealCell({ ...state, cells, phase: GamePhase.Active }, 5);
    expect(after.phase).toBe(GamePhase.Lost);
    expect(after.cells[5].isDetonated).toBe(true);
  });

  it('marks wrong flags on loss', () => {
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c }));
    cells[5].isMine = true;
    cells[3].displayState = CellDisplayState.Flagged; // not a mine → wrong
    const after = revealCell({ ...state, cells, phase: GamePhase.Active }, 5);
    expect(after.cells[3].isWrongFlag).toBe(true);
  });
});

// ─── SC4: flag cycle ──────────────────────────────────────────────────────────

describe('cycleFlag (SC4)', () => {
  it('cycles Hidden → Flagged → Question → Hidden in three calls', () => {
    let state = createGame('beginner');
    state = { ...state, phase: GamePhase.Active };

    state = cycleFlag(state, 0);
    expect(state.cells[0].displayState).toBe(CellDisplayState.Flagged);

    state = cycleFlag(state, 0);
    expect(state.cells[0].displayState).toBe(CellDisplayState.Question);

    state = cycleFlag(state, 0);
    expect(state.cells[0].displayState).toBe(CellDisplayState.Hidden);
  });

  it('does not cycle a revealed cell', () => {
    let state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c }));
    cells[0].displayState = CellDisplayState.Revealed;
    state = { ...state, cells, phase: GamePhase.Active };
    const after = cycleFlag(state, 0);
    expect(after.cells[0].displayState).toBe(CellDisplayState.Revealed);
  });
});

// ─── SC5: chord ───────────────────────────────────────────────────────────────

describe('chord (SC5)', () => {
  function boardWithChordSetup() {
    // 3×3 board:  mine at index 1, rest safe
    // Cell 4 (center) is revealed with adjacentMines = 1; cell 1 is flagged
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c, isMine: false, adjacentMines: 0 }));
    cells[1].isMine = true;
    cells[1].displayState = CellDisplayState.Flagged;
    // Compute adjacentMines for center cell (index 4) in a 3×3 arrangement
    cells[4].adjacentMines = 1;
    cells[4].displayState = CellDisplayState.Revealed;
    const small: typeof state = {
      ...state, rows: 3, cols: 3, totalMines: 1,
      cells: cells.slice(0, 9), phase: GamePhase.Active
    };
    return small;
  }

  it('reveals unflagged neighbors when flag count matches adjacentMines', () => {
    const state = boardWithChordSetup();
    const after = chord(state, 4);
    // All hidden neighbors of cell 4 (except the flagged mine) should be revealed
    const hiddenNeighbors = [0, 2, 3, 5, 6, 7, 8];
    for (const idx of hiddenNeighbors) {
      expect(after.cells[idx].displayState).toBe(CellDisplayState.Revealed);
    }
  });

  it('does nothing when flag count does not match adjacentMines', () => {
    const state = boardWithChordSetup();
    // Unflag cell 1
    const cells = state.cells.map(c => ({ ...c }));
    cells[1].displayState = CellDisplayState.Hidden;
    const noFlag = { ...state, cells };
    const after = chord(noFlag, 4);
    // No change — chord condition not met
    expect(after.cells[0].displayState).toBe(CellDisplayState.Hidden);
  });

  it('does nothing on a hidden cell', () => {
    const state = boardWithChordSetup();
    const after = chord(state, 0);
    expect(after).toBe(state);
  });

  it('triggers loss if chord reveals a mine (wrong flag)', () => {
    const state = boardWithChordSetup();
    // Flag a safe cell instead of the mine → chord will hit the unflagged mine
    const cells = state.cells.map(c => ({ ...c }));
    cells[1].displayState = CellDisplayState.Hidden; // unflag the actual mine
    cells[0].displayState = CellDisplayState.Flagged; // flag a safe cell instead
    const wrongFlag = { ...state, cells };
    const after = chord(wrongFlag, 4);
    expect(after.phase).toBe(GamePhase.Lost);
  });
});

// ─── SC6: mines-remaining counter ────────────────────────────────────────────

describe('flagCount — mines remaining (SC6)', () => {
  it('increments flagCount on flag, decrements on unflag', () => {
    let state = createGame('beginner');
    state = { ...state, phase: GamePhase.Active };

    state = cycleFlag(state, 0); // Hidden → Flagged
    expect(state.flagCount).toBe(1);

    state = cycleFlag(state, 0); // Flagged → Question (unflag)
    expect(state.flagCount).toBe(0);

    state = cycleFlag(state, 0); // Question → Hidden (no change to count)
    expect(state.flagCount).toBe(0);
  });

  it('may display negative values', () => {
    let state = createGame('beginner');
    state = { ...state, phase: GamePhase.Active, totalMines: 1 };
    // Flag more cells than there are mines
    for (let i = 0; i < 3; i++) {
      state = cycleFlag(state, i);
    }
    expect(state.totalMines - state.flagCount).toBe(-2);
  });
});

// ─── SC7: timer format ────────────────────────────────────────────────────────

describe('formatTime — MM:SS (SC7)', () => {
  it('formats 0 as 00:00', () => expect(formatTime(0)).toBe('00:00'));
  it('formats 59 as 00:59', () => expect(formatTime(59)).toBe('00:59'));
  it('formats 60 as 01:00', () => expect(formatTime(60)).toBe('01:00'));
  it('formats 3661 as 61:01', () => expect(formatTime(3661)).toBe('61:01'));
  it('formats 599 as 09:59', () => expect(formatTime(599)).toBe('09:59'));
});

// ─── createGame — board dimensions ───────────────────────────────────────────

describe('createGame — board dimensions', () => {
  it('beginner: 9×9, 10 mines', () => {
    const s = createGame('beginner');
    expect(s.rows).toBe(9);
    expect(s.cols).toBe(9);
    expect(s.totalMines).toBe(10);
    expect(s.cells.length).toBe(81);
  });

  it('intermediate: 16×16, 40 mines', () => {
    const s = createGame('intermediate');
    expect(s.rows).toBe(16);
    expect(s.cols).toBe(16);
    expect(s.totalMines).toBe(40);
    expect(s.cells.length).toBe(256);
  });

  it('expert: 16×30, 99 mines', () => {
    const s = createGame('expert');
    expect(s.rows).toBe(16);
    expect(s.cols).toBe(30);
    expect(s.totalMines).toBe(99);
    expect(s.cells.length).toBe(480);
  });

  it('starts in Idle phase with all cells hidden', () => {
    const s = createGame('beginner');
    expect(s.phase).toBe(GamePhase.Idle);
    expect(s.cells.every(c => c.displayState === CellDisplayState.Hidden)).toBe(true);
  });
});

// ─── checkWin — auto-flag mines on win ───────────────────────────────────────

describe('checkWin', () => {
  it('does not trigger until all non-mine cells are revealed', () => {
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c }));
    cells[0].isMine = true;
    // target = 81 - 1 = 80; revealedCount 79 is one short
    const s = { ...state, cells, totalMines: 1, phase: GamePhase.Active, revealedCount: 79 };
    expect(checkWin(s).phase).toBe(GamePhase.Active);
  });

  it('transitions to Won and auto-flags mines when all non-mine cells revealed', () => {
    const state = createGame('beginner');
    const cells = state.cells.map(c => ({ ...c }));
    cells[0].isMine = true;
    const s = { ...state, cells, totalMines: 1, phase: GamePhase.Active, revealedCount: 80 };
    const after = checkWin(s);
    expect(after.phase).toBe(GamePhase.Won);
    expect(after.cells[0].displayState).toBe(CellDisplayState.Flagged);
  });
});
