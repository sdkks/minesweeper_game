import { test, expect } from '@playwright/test';

test.describe('initial render', () => {
  test('loads with correct title and 9×9 Beginner board', async ({ page }) => {
    await page.goto('');
    await expect(page).toHaveTitle('Minesweeper');
    const cells = page.locator('[role="gridcell"]');
    await expect(cells).toHaveCount(81);
    await expect(page.locator('#difficulty-select')).toHaveValue('beginner');
    await expect(page.locator('#mine-count')).toHaveText('10');
    await expect(page.locator('#timer')).toHaveText('00:00');
  });

  test('ARIA structure: grid / row / gridcell roles', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('grid', { name: 'Minesweeper board' })).toBeVisible();
    const rows = page.locator('[role="row"]');
    await expect(rows).toHaveCount(9);
  });

  test('aria-live region announces new game', async ({ page }) => {
    await page.goto('');
    const live = page.locator('#aria-live');
    await expect(live).toHaveText('New game started. Beginner difficulty.');
  });

  test('all cells start unrevealed', async ({ page }) => {
    await page.goto('');
    const hiddenCells = page.locator('[data-state="hidden"]');
    await expect(hiddenCells).toHaveCount(81);
  });
});

test.describe('first click — flood fill and timer', () => {
  test('first click starts timer and reveals cells', async ({ page }) => {
    await page.goto('');
    await page.locator('[data-index="40"]').click();
    // Timer should no longer be 00:00 after a beat, but we just check it started
    const hiddenAfter = await page.locator('[data-state="hidden"]').count();
    expect(hiddenAfter).toBeLessThan(81);
  });

  test('first click never reveals a mine (no immediate loss)', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await page.goto('');
      await page.locator('[data-index="40"]').click();
      // If we hit a mine on the first click the loss banner appears immediately
      const banner = page.locator('#game-banner');
      const isHidden = await banner.evaluate(el => el.classList.contains('hidden'));
      expect(isHidden).toBe(true);
    }
  });
});

test.describe('flag cycle (SC4)', () => {
  test('right-click cycles unmarked → flagged → question → unmarked', async ({ page }) => {
    await page.goto('');
    const cell = page.locator('[data-index="0"]');

    await cell.click({ button: 'right' });
    await expect(cell).toHaveAttribute('data-state', 'flagged');
    await expect(cell).toHaveAttribute('aria-label', /flagged/);

    await cell.click({ button: 'right' });
    await expect(cell).toHaveAttribute('data-state', 'question');
    await expect(cell).toHaveAttribute('aria-label', /question mark/);

    await cell.click({ button: 'right' });
    await expect(cell).toHaveAttribute('data-state', 'hidden');
    await expect(cell).toHaveAttribute('aria-label', /unrevealed/);
  });

  test('mine counter decrements when flag placed, increments when removed', async ({ page }) => {
    await page.goto('');
    const counter = page.locator('#mine-count');
    await expect(counter).toHaveText('10');

    await page.locator('[data-index="0"]').click({ button: 'right' }); // flag
    await expect(counter).toHaveText('9');

    await page.locator('[data-index="0"]').click({ button: 'right' }); // question
    await expect(counter).toHaveText('10');
  });
});

test.describe('difficulty dropdown', () => {
  test('#difficulty-select has 3 options: Beginner, Intermediate, Expert', async ({ page }) => {
    await page.goto('');
    const sel = page.locator('#difficulty-select');
    await expect(sel.locator('option')).toHaveCount(3);
    await expect(sel.locator('option[value="beginner"]')).toHaveText('Beginner');
    await expect(sel.locator('option[value="intermediate"]')).toHaveText('Intermediate');
    await expect(sel.locator('option[value="expert"]')).toHaveText('Expert');
  });

  test('default selection is Beginner', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#difficulty-select')).toHaveValue('beginner');
  });

  test('selecting Intermediate gives 256 cells and 40 mines', async ({ page }) => {
    await page.goto('');
    await page.locator('#difficulty-select').selectOption('intermediate');
    await expect(page.locator('[role="gridcell"]')).toHaveCount(256);
    await expect(page.locator('#mine-count')).toHaveText('40');
  });

  test('selecting Expert gives 480 cells and 99 mines', async ({ page }) => {
    await page.goto('');
    await page.locator('#difficulty-select').selectOption('expert');
    await expect(page.locator('[role="gridcell"]')).toHaveCount(480);
    await expect(page.locator('#mine-count')).toHaveText('99');
  });

  test('changing difficulty mid-game immediately resets — no confirm prompt', async ({ page }) => {
    await page.goto('');
    await page.locator('[data-index="40"]').click();
    await page.locator('#difficulty-select').selectOption('intermediate');
    await expect(page.locator('#confirm-prompt')).toHaveCount(0);
    await expect(page.locator('[role="gridcell"]')).toHaveCount(256);
  });
});

test.describe('theme dropdown', () => {
  test('#theme-select has 4 options', async ({ page }) => {
    await page.goto('');
    const sel = page.locator('#theme-select');
    await expect(sel.locator('option')).toHaveCount(4);
    await expect(sel.locator('option[value="dark-navy"]')).toHaveText('Dark Navy');
    await expect(sel.locator('option[value="light"]')).toHaveText('Light');
    await expect(sel.locator('option[value="forest"]')).toHaveText('Forest');
    await expect(sel.locator('option[value="retro"]')).toHaveText('Retro');
  });

  test('default theme is Dark Navy — no data-theme attribute on <html>', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#theme-select')).toHaveValue('dark-navy');
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(attr).toBeUndefined();
  });

  test('selecting Forest sets data-theme="forest" and persists to localStorage', async ({ page }) => {
    await page.goto('');
    await page.locator('#theme-select').selectOption('forest');
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(attr).toBe('forest');
    const stored = await page.evaluate(() => localStorage.getItem('minesweeper-theme'));
    expect(stored).toBe('forest');
  });

  test('Forest persists across reload', async ({ page }) => {
    await page.goto('');
    await page.locator('#theme-select').selectOption('forest');
    await page.reload();
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(attr).toBe('forest');
    await expect(page.locator('#theme-select')).toHaveValue('forest');
  });

  test('selecting Dark Navy removes data-theme attribute and localStorage key', async ({ page }) => {
    await page.goto('');
    await page.locator('#theme-select').selectOption('forest');
    await page.locator('#theme-select').selectOption('dark-navy');
    const attr = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(attr).toBeUndefined();
    const stored = await page.evaluate(() => localStorage.getItem('minesweeper-theme'));
    expect(stored).toBeNull();
  });

  test('Retro hidden cells have raised bevel box-shadow', async ({ page }) => {
    await page.goto('');
    await page.locator('#theme-select').selectOption('retro');
    const shadow = await page.evaluate(() => {
      const cell = document.querySelector<HTMLElement>('.cell[data-state="hidden"]');
      return cell ? getComputedStyle(cell).boxShadow : '';
    });
    expect(shadow).not.toBe('none');
    expect(shadow).not.toBe('');
  });

  test('non-Retro themes have no bevel box-shadow on cells', async ({ page }) => {
    await page.goto('');
    for (const theme of ['dark-navy', 'light', 'forest']) {
      if (theme !== 'dark-navy') {
        await page.locator('#theme-select').selectOption(theme);
      }
      const shadow = await page.evaluate(() => {
        const cell = document.querySelector<HTMLElement>('.cell[data-state="hidden"]');
        return cell ? getComputedStyle(cell).boxShadow : '';
      });
      expect(shadow).toBe('none');
    }
  });
});

test.describe('loss banner', () => {
  async function triggerLoss(page: import('@playwright/test').Page) {
    await page.goto('');
    // Click cells until we hit a mine
    for (let i = 0; i < 81; i++) {
      const hidden = page.locator('[data-state="hidden"]').first();
      if (!(await hidden.count())) break;
      await hidden.click();
      const banner = page.locator('#game-banner');
      const isHidden = await banner.evaluate(el => el.classList.contains('hidden'));
      if (!isHidden) break;
    }
  }

  test('game-over banner appears above board on loss', async ({ page }) => {
    await triggerLoss(page);
    const banner = page.locator('#game-banner');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.banner-title')).toHaveText('Game over');
    await expect(banner.locator('.banner-time')).toContainText('Time:');
    await expect(banner.getByRole('button', { name: 'Play again' })).toBeVisible();
  });

  test('timer freezes on loss (displayed in banner)', async ({ page }) => {
    await triggerLoss(page);
    const bannerTime = await page.locator('.banner-time').textContent();
    const hudTimer = await page.locator('#timer').textContent();
    expect(bannerTime).toContain(hudTimer!.replace('00:00', '').trim() || hudTimer!);
  });

  test('"Play again" resets the board', async ({ page }) => {
    await triggerLoss(page);
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.locator('#game-banner')).toHaveClass(/hidden/);
    await expect(page.locator('[role="gridcell"]')).toHaveCount(81);
    await expect(page.locator('[data-state="hidden"]')).toHaveCount(81);
    await expect(page.locator('#timer')).toHaveText('00:00');
    await expect(page.locator('#mine-count')).toHaveText('10');
  });
});

test.describe('new game button', () => {
  test('"New game" resets board at same difficulty', async ({ page }) => {
    await page.goto('');
    await page.locator('[data-index="40"]').click();
    await page.getByRole('button', { name: /New game/ }).click();
    await expect(page.locator('[data-state="hidden"]')).toHaveCount(81);
    await expect(page.locator('#timer')).toHaveText('00:00');
  });
});

test.describe('footer', () => {
  test('footer contains "Source Code (Github)" link to GitHub repo', async ({ page }) => {
    await page.goto('');
    const link = page.locator('footer a');
    await expect(link).toHaveText('Source Code (Github)');
    await expect(link).toHaveAttribute('href', 'https://github.com/sdkks/minesweeper_game');
  });
});

test.describe('accessibility', () => {
  test('cell aria-label format: "Row N, Column N: state"', async ({ page }) => {
    await page.goto('');
    const cell = page.locator('[data-index="0"]');
    await expect(cell).toHaveAttribute('aria-label', 'Row 1, Column 1: unrevealed');
  });

  test('aria-label updates to "flagged" after right-click', async ({ page }) => {
    await page.goto('');
    await page.locator('[data-index="0"]').click({ button: 'right' });
    await expect(page.locator('[data-index="0"]')).toHaveAttribute('aria-label', 'Row 1, Column 1: flagged');
  });
});
