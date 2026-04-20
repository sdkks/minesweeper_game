// ============================================================
// Renderer — builds DOM once, diffs on render().
// ARIA: role="grid" / role="row" / role="gridcell"
// Roving tabindex for keyboard navigation (APG grid pattern).
// ============================================================

import {
  type GameState,
  type Cell,
  CellDisplayState,
} from './types';
import { formatTime } from './utils';
import { applyTheme } from './theme';

// ------------------------------------------------------------
// Module-level state
// ------------------------------------------------------------

let boardEl: HTMLElement | null = null;
let bannerEl: HTMLElement | null = null;
let mineCountEl: HTMLElement | null = null;
let timerEl: HTMLElement | null = null;

// Previous cell snapshot for diffing
let prevCells: Cell[] = [];

// Current focused cell index for roving tabindex
let focusedIndex = 0;

// Rows/cols needed for arrow-key navigation
let _rows = 0;
let _cols = 0;

// ------------------------------------------------------------
// Cell display helpers
// ------------------------------------------------------------

function cellIcon(cell: Cell): string {
  if (cell.isDetonated) return '💥';
  if (cell.isWrongFlag) return '✗';
  if (cell.displayState === CellDisplayState.Flagged) return '⚑';
  if (cell.displayState === CellDisplayState.Question) return '?';
  if (cell.displayState === CellDisplayState.Revealed) {
    if (cell.isMine) return '✸';
    if (cell.adjacentMines > 0) return String(cell.adjacentMines);
    return '';
  }
  return '';
}

function cellAriaLabel(cell: Cell, row: number, col: number): string {
  let state: string;
  if (cell.isDetonated) {
    state = 'mine';
  } else if (cell.isWrongFlag) {
    state = 'wrong flag';
  } else if (cell.displayState === CellDisplayState.Flagged) {
    state = 'flagged';
  } else if (cell.displayState === CellDisplayState.Question) {
    state = 'question mark';
  } else if (cell.displayState === CellDisplayState.Revealed) {
    if (cell.isMine) {
      state = 'mine';
    } else if (cell.adjacentMines > 0) {
      state = `${cell.adjacentMines} adjacent mines`;
    } else {
      state = 'clear';
    }
  } else {
    state = 'unrevealed';
  }
  return `Row ${row + 1}, Column ${col + 1}: ${state}`;
}

function cellDataState(cell: Cell): string {
  if (cell.displayState === CellDisplayState.Revealed) {
    return cell.isMine ? 'mine' : 'revealed';
  }
  if (cell.displayState === CellDisplayState.Flagged) return 'flagged';
  if (cell.displayState === CellDisplayState.Question) return 'question';
  return 'hidden';
}

// ------------------------------------------------------------
// init — build the full DOM for a given state
// ------------------------------------------------------------

export function init(container: HTMLElement, state: GameState): void {
  // Null stale element refs before innerHTML wipe so setMineCount/setTimer
  // don't write to detached nodes if called between init() and buildControlsRow().
  mineCountEl = null;
  timerEl = null;

  if (boardEl) {
    boardEl.removeEventListener('keydown', handleArrowKey);
    boardEl = null;
  }

  container.innerHTML = '';
  _rows = state.rows;
  _cols = state.cols;

  // Controls row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'controls-row';
  controlsRow.id = 'controls-row';
  container.appendChild(controlsRow);

  // Banner placeholder (hidden initially)
  bannerEl = document.createElement('div');
  bannerEl.className = 'game-banner hidden';
  bannerEl.id = 'game-banner';
  bannerEl.setAttribute('role', 'status');
  container.appendChild(bannerEl);

  // Board scroll wrapper
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'board-scroll';

  // Board grid
  boardEl = document.createElement('div');
  boardEl.className = 'board';
  boardEl.setAttribute('role', 'grid');
  boardEl.setAttribute('aria-label', 'Minesweeper board');
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;

  for (let r = 0; r < state.rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';
    rowEl.setAttribute('role', 'row');

    for (let c = 0; c < state.cols; c++) {
      const idx = r * state.cols + c;
      const cell = state.cells[idx];
      const cellEl = buildCellEl(cell, r, c, idx === 0);
      rowEl.appendChild(cellEl);
    }

    boardEl.appendChild(rowEl);
  }

  scrollWrap.appendChild(boardEl);
  container.appendChild(scrollWrap);

  // Wire arrow-key navigation at the board level
  boardEl.addEventListener('keydown', handleArrowKey);

  prevCells = state.cells.map(c => ({ ...c }));
  focusedIndex = 0;
}

function buildCellEl(cell: Cell, row: number, col: number, isTabStop: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cell';
  el.setAttribute('role', 'gridcell');
  el.setAttribute('data-index', String(cell.index));
  applyCell(el, cell, row, col);
  el.tabIndex = isTabStop ? 0 : -1;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cell-icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = cellIcon(cell);
  el.appendChild(iconSpan);

  return el;
}

function applyCell(el: HTMLElement, cell: Cell, row: number, col: number): void {
  el.setAttribute('aria-label', cellAriaLabel(cell, row, col));
  el.setAttribute('data-state', cellDataState(cell));
  el.setAttribute('data-detonated', String(cell.isDetonated));
  el.setAttribute('data-wrong-flag', String(cell.isWrongFlag));

  if (
    cell.displayState === CellDisplayState.Revealed &&
    !cell.isMine &&
    cell.adjacentMines > 0
  ) {
    el.setAttribute('data-adj', String(cell.adjacentMines));
  } else {
    el.removeAttribute('data-adj');
  }
}

// ------------------------------------------------------------
// render — diff against previous cells snapshot
// ------------------------------------------------------------

export function render(state: GameState): void {
  if (!boardEl) return;
  _rows = state.rows;
  _cols = state.cols;

  const cellEls = boardEl.querySelectorAll<HTMLElement>('.cell');

  for (let i = 0; i < state.cells.length; i++) {
    const cell = state.cells[i];
    const prev = prevCells[i];

    if (
      cell.displayState === prev.displayState &&
      cell.isDetonated === prev.isDetonated &&
      cell.isWrongFlag === prev.isWrongFlag
    ) {
      continue;
    }

    const el = cellEls[i];
    if (!el) continue;

    const row = Math.floor(i / state.cols);
    const col = i % state.cols;
    applyCell(el, cell, row, col);

    const iconSpan = el.querySelector<HTMLElement>('.cell-icon');
    if (iconSpan) iconSpan.textContent = cellIcon(cell);
  }

  prevCells = state.cells.map(c => ({ ...c }));
}

// ------------------------------------------------------------
// setMineCount / setTimer
// ------------------------------------------------------------

export function setMineCount(remaining: number): void {
  if (mineCountEl) mineCountEl.textContent = String(remaining);
}

export function setTimer(seconds: number): void {
  if (timerEl) timerEl.textContent = formatTime(seconds);
}

// ------------------------------------------------------------
// showBanner / hideBanner
// ------------------------------------------------------------

export function showBanner(
  result: 'won' | 'lost',
  elapsed: number,
  onReset: () => void
): void {
  if (!bannerEl) return;
  bannerEl.innerHTML = '';
  bannerEl.classList.remove('hidden');

  const title = document.createElement('div');
  title.className = 'banner-title';
  title.textContent = result === 'won' ? 'You win!' : 'Game over';

  const timeEl = document.createElement('div');
  timeEl.className = 'banner-time';
  timeEl.textContent = `Time: ${formatTime(elapsed)}`;

  const btn = document.createElement('button');
  btn.className = 'play-again-btn';
  btn.textContent = 'Play again';
  btn.addEventListener('click', onReset);

  bannerEl.appendChild(title);
  bannerEl.appendChild(timeEl);
  bannerEl.appendChild(btn);

  // Move focus to the Play again button
  requestAnimationFrame(() => btn.focus());
}

export function hideBanner(): void {
  if (!bannerEl) return;
  bannerEl.classList.add('hidden');
  bannerEl.innerHTML = '';
}

// ------------------------------------------------------------
// buildControlsRow — called by main to populate the controls row
// ------------------------------------------------------------

export function buildControlsRow(
  container: HTMLElement,
  state: GameState,
  onDifficultyChange: (key: string) => void,
  onNewGame: () => void
): void {
  const row = container.querySelector<HTMLElement>('#controls-row');
  if (!row) return;
  row.innerHTML = '';

  // HUD
  const hud = document.createElement('div');
  hud.className = 'hud';

  const flagItem = document.createElement('div');
  flagItem.className = 'hud-item';
  const flagLabel = document.createElement('span');
  flagLabel.className = 'hud-label';
  flagLabel.textContent = 'Flags:';
  mineCountEl = document.createElement('span');
  mineCountEl.className = 'hud-value';
  mineCountEl.id = 'mine-count';
  mineCountEl.textContent = String(state.totalMines - state.flagCount);
  flagItem.appendChild(flagLabel);
  flagItem.appendChild(mineCountEl);

  const timerItem = document.createElement('div');
  timerItem.className = 'hud-item';
  const timerLabel = document.createElement('span');
  timerLabel.className = 'hud-label';
  timerLabel.textContent = 'Time:';
  timerEl = document.createElement('span');
  timerEl.className = 'hud-value';
  timerEl.id = 'timer';
  timerEl.textContent = '00:00';
  timerItem.appendChild(timerLabel);
  timerItem.appendChild(timerEl);

  hud.appendChild(flagItem);
  hud.appendChild(timerItem);
  row.appendChild(hud);

  // Difficulty dropdown
  const diffLabel = document.createElement('label');
  diffLabel.className = 'controls-label';
  diffLabel.textContent = 'Diff';
  const diffSelect = document.createElement('select');
  diffSelect.id = 'difficulty-select';
  diffSelect.className = 'controls-select';
  diffSelect.setAttribute('aria-label', 'Difficulty');
  const difficulties: { key: string; label: string }[] = [
    { key: 'beginner', label: 'Beginner' },
    { key: 'intermediate', label: 'Intermediate' },
    { key: 'expert', label: 'Expert' },
  ];
  for (const { key, label } of difficulties) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    if (key === state.difficulty) opt.selected = true;
    diffSelect.appendChild(opt);
  }
  diffSelect.addEventListener('change', () => onDifficultyChange(diffSelect.value));
  diffLabel.appendChild(diffSelect);
  row.appendChild(diffLabel);

  // Theme dropdown
  const themeLabel = document.createElement('label');
  themeLabel.className = 'controls-label';
  themeLabel.textContent = 'Theme';
  const themeSelect = document.createElement('select');
  themeSelect.id = 'theme-select';
  themeSelect.className = 'controls-select';
  themeSelect.setAttribute('aria-label', 'Theme');
  const themes: { key: string; label: string }[] = [
    { key: 'dark-navy', label: 'Dark Navy' },
    { key: 'light', label: 'Light' },
    { key: 'forest', label: 'Forest' },
    { key: 'retro', label: 'Retro' },
  ];
  const currentTheme = document.documentElement.dataset.theme || 'dark-navy';
  for (const { key, label } of themes) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    if (key === currentTheme) opt.selected = true;
    themeSelect.appendChild(opt);
  }
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value as Parameters<typeof applyTheme>[0]));
  themeLabel.appendChild(themeSelect);
  row.appendChild(themeLabel);

  // New game button
  const newBtn = document.createElement('button');
  newBtn.className = 'new-game-btn';
  newBtn.textContent = 'New game';
  newBtn.addEventListener('click', onNewGame);
  row.appendChild(newBtn);
}


// ------------------------------------------------------------
// Roving tabindex — arrow-key navigation
// ------------------------------------------------------------

export function moveFocus(newIndex: number): void {
  if (!boardEl) return;
  const cellEls = boardEl.querySelectorAll<HTMLElement>('.cell');
  if (focusedIndex >= 0 && focusedIndex < cellEls.length) {
    cellEls[focusedIndex].tabIndex = -1;
  }
  focusedIndex = newIndex;
  if (focusedIndex >= 0 && focusedIndex < cellEls.length) {
    cellEls[focusedIndex].tabIndex = 0;
    cellEls[focusedIndex].focus();
  }
}

function handleArrowKey(e: KeyboardEvent): void {
  const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (!arrowKeys.includes(e.key)) return;

  e.preventDefault();
  const cur = focusedIndex;
  const row = Math.floor(cur / _cols);
  const col = cur % _cols;

  let newRow = row;
  let newCol = col;

  if (e.key === 'ArrowUp')    newRow = Math.max(0, row - 1);
  if (e.key === 'ArrowDown')  newRow = Math.min(_rows - 1, row + 1);
  if (e.key === 'ArrowLeft')  newCol = Math.max(0, col - 1);
  if (e.key === 'ArrowRight') newCol = Math.min(_cols - 1, col + 1);

  const newIndex = newRow * _cols + newCol;
  if (newIndex !== cur) moveFocus(newIndex);
}

export function syncFocusedIndex(index: number): void {
  focusedIndex = index;
}
