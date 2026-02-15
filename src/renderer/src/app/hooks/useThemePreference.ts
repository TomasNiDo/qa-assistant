import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ThemeMode } from '../types';

const THEME_STORAGE_KEY = 'qa-assistant-theme';

export function useThemePreference(): {
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
} {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      root.classList.toggle('dark', storedTheme === 'dark');
      setTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextTheme: ThemeMode = prefersDark ? 'dark' : 'light';
    root.classList.toggle('dark', prefersDark);
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}
