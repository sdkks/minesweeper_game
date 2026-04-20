import { defineConfig } from 'vite';

export default defineConfig({
  base: '/minesweeper_game/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
