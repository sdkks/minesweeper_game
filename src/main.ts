// ============================================================
// main.ts — owns single mutable GameState.
// Wires input → state → renderer → timer.
// ============================================================

import {
  type GameState,
  type DifficultyKey,
  type InputAction,
  GamePhase,
  CellDisplayState,
} from './types';
import { formatTime } from './utils';
import {
  createGame,
  placeMines,
  revealCell,
  cycleFlag,
  chord,
} from './state';
import * as renderer from './renderer';
import * as input from './input';
import * as timer from './timer';
import { initTheme } from './theme';

// ------------------------------------------------------------
// Module-level mutable state
// ------------------------------------------------------------

let gameState: GameState = createGame('beginner');

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------

function main(): void {
  const root = document.getElementById('game-root');
  if (!root) throw new Error('Missing #game-root');

  const ariaLive = document.getElementById('aria-live');

  initTheme();
  renderer.init(root, gameState);
  renderer.buildControlsRow(root, gameState, handleDifficultyClick, handleNewGame);
  renderer.setMineCount(gameState.totalMines - gameState.flagCount);

  attachInput(root);
  announce(ariaLive, 'New game started. Beginner difficulty.');
}

function attachInput(root: HTMLElement): void {
  const board = root.querySelector<HTMLElement>('.board');
  if (!board) return;
  input.attach(board, handleAction, () => gameState);
}

// ------------------------------------------------------------
// Action handler
// ------------------------------------------------------------

function handleAction(action: InputAction): void {
  if (gameState.phase === GamePhase.Won || gameState.phase === GamePhase.Lost) {
    return;
  }

  const root = document.getElementById('game-root')!;
  const ariaLive = document.getElementById('aria-live');

  // Update roving tabindex focus tracker
  if ('index' in action) {
    renderer.syncFocusedIndex(action.index);
  }

  switch (action.type) {
    case 'reveal': {
      const cell = gameState.cells[action.index];
      if (cell.displayState !== CellDisplayState.Hidden) return;

      if (gameState.phase === GamePhase.Idle) {
        // First click: place mines then reveal
        gameState = placeMines(gameState, action.index);
        timer.reset();
        timer.start(seconds => {
          gameState = { ...gameState, elapsedSeconds: seconds };
          renderer.setTimer(seconds);
        });
      }

      gameState = revealCell(gameState, action.index);
      break;
    }

    case 'flag': {
      if (gameState.phase === GamePhase.Idle || gameState.phase === GamePhase.Active) {
        gameState = cycleFlag(gameState, action.index);
      }
      break;
    }

    case 'chord': {
      gameState = chord(gameState, action.index);
      break;
    }
  }

  renderer.render(gameState);
  renderer.setMineCount(gameState.totalMines - gameState.flagCount);

  if (gameState.phase === GamePhase.Won || gameState.phase === GamePhase.Lost) {
    timer.stop();
    const result = gameState.phase === GamePhase.Won ? 'won' : 'lost';
    renderer.showBanner(result, gameState.elapsedSeconds, () => handleNewGame());

    const msg = gameState.phase === GamePhase.Won
      ? `You win! Time: ${formatTime(gameState.elapsedSeconds)}.`
      : 'Game over. You hit a mine.';
    announce(ariaLive, msg);

    // Detach input to prevent further moves
    const board = root.querySelector<HTMLElement>('.board');
    if (board) input.detach(board);
  }
}

// ------------------------------------------------------------
// Difficulty selector
// ------------------------------------------------------------

function handleDifficultyClick(key: string): void {
  const dk = key as DifficultyKey;
  if (dk === gameState.difficulty) return;
  resetGame(dk);
}

// ------------------------------------------------------------
// New game / reset
// ------------------------------------------------------------

function handleNewGame(): void {
  resetGame(gameState.difficulty);
}

function resetGame(difficulty: DifficultyKey): void {
  const root = document.getElementById('game-root')!;
  const ariaLive = document.getElementById('aria-live');

  // Detach old input
  const oldBoard = root.querySelector<HTMLElement>('.board');
  if (oldBoard) input.detach(oldBoard);

  timer.reset();

  gameState = createGame(difficulty);

  renderer.hideBanner();
  renderer.init(root, gameState);
  renderer.buildControlsRow(root, gameState, handleDifficultyClick, handleNewGame);
  renderer.setMineCount(gameState.totalMines - gameState.flagCount);
  renderer.setTimer(0);

  attachInput(root);

  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  announce(ariaLive, `New game started. ${label} difficulty.`);
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function announce(region: HTMLElement | null, msg: string): void {
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = msg;
  });
}

main();
