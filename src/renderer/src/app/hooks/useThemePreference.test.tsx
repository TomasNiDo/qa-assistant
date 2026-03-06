import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useThemePreference } from './useThemePreference';

const STORAGE_KEY = 'qa-assistant-theme-mode';

describe('useThemePreference', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('restores persisted light mode and removes dark class', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light');
    document.documentElement.classList.add('dark');

    const { result } = renderHook(() => useThemePreference());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies and persists theme changes', () => {
    const { result } = renderHook(() => useThemePreference());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});
