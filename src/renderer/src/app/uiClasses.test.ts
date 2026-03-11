import { describe, expect, it } from 'vitest';
import {
  dangerButtonClass,
  fieldClass,
  mutedButtonClass,
  primaryButtonClass,
  subtleButtonClass,
} from './uiClasses';

describe('uiClasses', () => {
  it('defines focus and disabled states for all button primitives', () => {
    for (const buttonClass of [
      primaryButtonClass,
      mutedButtonClass,
      dangerButtonClass,
      subtleButtonClass,
    ]) {
      expect(buttonClass).toContain('focus-visible:ring-2');
      expect(buttonClass).toContain('disabled:opacity-60');
      expect(buttonClass).toContain('disabled:cursor-not-allowed');
    }
  });

  it('defines interactive field states for shared inputs', () => {
    expect(fieldClass).toContain('hover:border-border-strong');
    expect(fieldClass).toContain('focus-visible:border-ring');
    expect(fieldClass).toContain('focus-visible:ring-2');
    expect(fieldClass).toContain('disabled:opacity-60');
  });
});
