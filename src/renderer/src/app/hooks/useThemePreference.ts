import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ThemeMode } from '../types';

export function useThemePreference(): {
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
} {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return {
    theme,
    setTheme: (value) => {
      setTheme((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        return next === 'dark' ? 'dark' : 'dark';
      });
      document.documentElement.classList.add('dark');
    },
  };
}

