# Contributing

Thank you for your interest in contributing to Minesweeper Game!

This is a personal project maintained with limited available time. Contributions via issues and pull requests are appreciated.

## Guiding Principles

- Keep the app simple and easy to run
- Minimize external dependencies
- Aim for a maintenance-free, statically hosted SPA
- Prioritize accessible UI

## How to Contribute

### Reporting Bugs

Open a GitHub Issue using the **Bug Report** template. Please include:

- A screenshot or screen recording of the issue
- Steps to reproduce
- What you expected to happen
- What actually happened
- Browser and device info

### Suggesting Features

Open a GitHub Issue using the **Feature Request** template. Keep suggestions aligned with the project's goal of simplicity.

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run `make build` to verify the build passes
5. Run `make test` to ensure all tests pass
6. Submit a PR using the pull request template

### Development Setup

```bash
git clone https://github.com/sdkks/minesweeper_game.git
cd minesweeper_game
npm install
make dev
```

The dev server runs at `http://localhost:5173/`.

## Response Times

As this is a personal project, response times on issues and PRs may vary. Please be patient. Stale PRs or those labeled `won't do` may be closed automatically in the future.
