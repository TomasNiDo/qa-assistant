import { useLayoutEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'qa-assistant-theme-mode';

function resolveStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Ignore storage failures and fall back to dark mode.
  }

  return 'dark';
}

function applyThemeClass(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useThemePreference(): {
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
} {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveStoredThemeMode());

  useLayoutEffect(() => {
    applyThemeClass(theme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures and keep runtime state only.
    }
  }, [theme]);

  return {
    theme,
    setTheme: (value) => {
      setTheme((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        return next === 'light' ? 'light' : 'dark';
      });
    },
  };
}
