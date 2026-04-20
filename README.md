# Minesweeper Game

A classic Minesweeper game that runs entirely in the browser. No server required. Built with vanilla TypeScript, bundled with Vite, and hosted on GitHub Pages.

**Live demo:** [https://sdkks.github.io/minesweeper_game](https://sdkks.github.io/minesweeper_game)

## Features

- Three difficulty levels: Beginner (9×9, 10 mines), Intermediate (16×16, 40 mines), Expert (16×30, 99 mines)
- Safe first click — mines are placed after your first reveal
- Flag and question-mark cycling with right-click or long-press on mobile
- Chord reveal (click on a revealed number with enough flags placed)
- Elapsed timer and mine counter
- Win/loss banner with time display
- Keyboard accessible — full arrow-key navigation and roving tabindex
- Screen reader support via ARIA live region announcements
- No backend dependencies — deploy anywhere that serves static files

## How to Play

1. Select a difficulty (Beginner, Intermediate, Expert) and click **New Game**
2. Click any cell to reveal it — the first click is always safe
3. Numbers indicate how many mines are adjacent to that cell
4. Right-click (or long-press on mobile) to place a flag on a suspected mine
5. Reveal all non-mine cells to win

### Controls

| Action | Mouse | Keyboard |
|--------|-------|----------|
| Reveal cell | Left-click | Enter / Space |
| Flag cell | Right-click | F |
| Chord reveal | Click on number | Enter / Space on number |
| Navigate board | — | Arrow keys |

## Development

### Prerequisites

- Node.js (with npm)
- Make

### Setup and Commands

```bash
git clone https://github.com/sdkks/minesweeper_game.git
cd minesweeper_game
npm install
make dev            # starts dev server at localhost:5173/
make build          # production build
make test           # runs unit tests + Playwright E2E tests
make test-unit      # runs Vitest unit tests only
make test-e2e       # runs Playwright E2E tests only
```

### Testing

The project includes:

- **Vitest unit tests** (`src/state.test.ts`) covering game state logic: mine placement, cell reveal, flagging, chord, win/loss detection
- **Playwright E2E tests** (`e2e/game.spec.ts`) covering full browser interaction

Run `make test` to execute both suites.

### Tech Stack

- Vanilla TypeScript
- Vite (bundler and dev server)
- [Vitest](https://vitest.dev/) (unit tests)
- [Playwright](https://playwright.dev/) (E2E browser tests)
- GitHub Actions (CI/CD to GitHub Pages)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the [MIT License](LICENSE).
