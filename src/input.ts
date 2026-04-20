// ============================================================
// Input — event delegation on the board container.
// Handles desktop (click / right-click) and mobile (tap / long-press).
// ============================================================

import type { InputAction, CellIndex } from './types';
import { CellDisplayState } from './types';
import type { GameState } from './types';

// Long-press threshold and movement tolerance
const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10; // px

interface TouchState {
  timerId: ReturnType<typeof setTimeout> | null;
  startX: number;
  startY: number;
  index: CellIndex;
  fired: boolean; // long-press already fired on this touch
}

let touchState: TouchState | null = null;

// Keep a reference so we can detach cleanly
let _onAction: ((action: InputAction) => void) | null = null;
let _getState: (() => GameState) | null = null;

// Bound handler references for removal
const handlers = {
  click: handleClick,
  contextmenu: handleContextMenu,
  touchstart: handleTouchStart,
  touchend: handleTouchEnd,
  touchmove: handleTouchMove,
  touchcancel: handleTouchCancel,
  keydown: handleKeyDown,
};

export function attach(
  board: HTMLElement,
  onAction: (action: InputAction) => void,
  getState: () => GameState
): void {
  _onAction = onAction;
  _getState = getState;

  board.addEventListener('click', handlers.click);
  board.addEventListener('contextmenu', handlers.contextmenu);
  board.addEventListener('touchstart', handlers.touchstart, { passive: false });
  board.addEventListener('touchend', handlers.touchend);
  board.addEventListener('touchmove', handlers.touchmove, { passive: true });
  board.addEventListener('touchcancel', handlers.touchcancel);
  board.addEventListener('keydown', handlers.keydown);
}

export function detach(board: HTMLElement): void {
  board.removeEventListener('click', handlers.click);
  board.removeEventListener('contextmenu', handlers.contextmenu);
  board.removeEventListener('touchstart', handlers.touchstart);
  board.removeEventListener('touchend', handlers.touchend);
  board.removeEventListener('touchmove', handlers.touchmove);
  board.removeEventListener('touchcancel', handlers.touchcancel);
  board.removeEventListener('keydown', handlers.keydown);
  _onAction = null;
  _getState = null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function getCellIndex(target: EventTarget | null): CellIndex | null {
  const el = (target as HTMLElement)?.closest<HTMLElement>('[data-index]');
  if (!el) return null;
  const idx = parseInt(el.dataset.index ?? '', 10);
  return isNaN(idx) ? null : idx;
}

function dispatch(action: InputAction): void {
  _onAction?.(action);
}

function getState(): GameState | null {
  return _getState?.() ?? null;
}

// ------------------------------------------------------------
// Desktop handlers
// ------------------------------------------------------------

function handleClick(e: MouseEvent): void {
  const index = getCellIndex(e.target);
  if (index === null) return;

  const state = getState();
  if (!state) return;

  const cell = state.cells[index];
  if (!cell) return;

  // Chord: left-click on a revealed numbered cell
  if (
    cell.displayState === CellDisplayState.Revealed &&
    !cell.isMine &&
    cell.adjacentMines > 0
  ) {
    dispatch({ type: 'chord', index });
    return;
  }

  // Reveal: left-click on hidden unflagged cell
  if (cell.displayState === CellDisplayState.Hidden) {
    dispatch({ type: 'reveal', index });
  }
}

function handleContextMenu(e: MouseEvent): void {
  e.preventDefault();
  const index = getCellIndex(e.target);
  if (index === null) return;
  dispatch({ type: 'flag', index });
}

// ------------------------------------------------------------
// Mobile handlers
// ------------------------------------------------------------

function handleTouchStart(e: TouchEvent): void {
  // Suppress context menu on long-press
  e.preventDefault();

  if (e.touches.length !== 1) {
    cancelLongPress();
    return;
  }

  const touch = e.touches[0];
  const index = getCellIndex(touch.target as EventTarget);
  if (index === null) return;

  cancelLongPress();

  touchState = {
    timerId: setTimeout(() => {
      if (touchState && !touchState.fired) {
        touchState.fired = true;
        dispatch({ type: 'flag', index: touchState.index });
      }
    }, LONG_PRESS_MS),
    startX: touch.clientX,
    startY: touch.clientY,
    index,
    fired: false,
  };
}

function handleTouchEnd(e: TouchEvent): void {
  if (!touchState) return;

  if (!touchState.fired) {
    // Short tap — fire reveal or chord
    cancelLongPress();
    const { index } = touchState;
    touchState = null;

    const state = getState();
    if (!state) return;

    const cell = state.cells[index];
    if (!cell) return;

    if (
      cell.displayState === CellDisplayState.Revealed &&
      !cell.isMine &&
      cell.adjacentMines > 0
    ) {
      dispatch({ type: 'chord', index });
      return;
    }

    if (cell.displayState === CellDisplayState.Hidden) {
      dispatch({ type: 'reveal', index });
    }
  } else {
    cancelLongPress();
    touchState = null;
  }

  // Suppress simulated mouse events
  e.preventDefault();
}

function handleTouchMove(e: TouchEvent): void {
  if (!touchState) return;
  const touch = e.touches[0];
  if (!touch) return;

  const dx = touch.clientX - touchState.startX;
  const dy = touch.clientY - touchState.startY;
  if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
    cancelLongPress();
    touchState = null;
  }
}

function handleTouchCancel(): void {
  cancelLongPress();
  touchState = null;
}

function cancelLongPress(): void {
  if (touchState?.timerId !== null && touchState?.timerId !== undefined) {
    clearTimeout(touchState.timerId);
  }
}

// ------------------------------------------------------------
// Keyboard handler (Enter / Space to activate focused cell)
// ------------------------------------------------------------

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' && e.key !== ' ') return;

  const index = getCellIndex(e.target);
  if (index === null) return;

  e.preventDefault();

  const state = getState();
  if (!state) return;

  const cell = state.cells[index];
  if (!cell) return;

  if (e.key === 'Enter') {
    if (
      cell.displayState === CellDisplayState.Revealed &&
      !cell.isMine &&
      cell.adjacentMines > 0
    ) {
      dispatch({ type: 'chord', index });
    } else if (cell.displayState === CellDisplayState.Hidden) {
      dispatch({ type: 'reveal', index });
    }
  } else if (e.key === ' ') {
    // Space to flag
    if (cell.displayState !== CellDisplayState.Revealed) {
      dispatch({ type: 'flag', index });
    }
  }
}
