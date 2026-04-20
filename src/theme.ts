const STORAGE_KEY = 'minesweeper-theme';
const VALID_THEMES = ['light', 'forest', 'retro'] as const;
type ThemeName = typeof VALID_THEMES[number] | 'dark-navy';

export function initTheme(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as typeof VALID_THEMES[number])) {
      document.documentElement.dataset.theme = stored;
    }
  } catch (_) {}
}

export function applyTheme(name: ThemeName): void {
  if (name === 'dark-navy') {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  } else if (VALID_THEMES.includes(name as typeof VALID_THEMES[number])) {
    document.documentElement.dataset.theme = name;
    try { localStorage.setItem(STORAGE_KEY, name); } catch (_) {}
  }
}
