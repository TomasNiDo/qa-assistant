import { describe, expect, it } from 'vitest';
import type { Feature, TestCase } from '@shared/types';
import { resolveSelectedTestId } from './useTestsDomain';

describe('useTestsDomain logic helpers', () => {
  it('prefers explicit preferredTestId when present', () => {
    const nextTree = {
      f1: [{ id: 't1' }, { id: 't2' }],
      f2: [{ id: 't3' }],
    } as unknown as Record<string, TestCase[]>;
    const rows = [{ id: 'f1' }, { id: 'f2' }] as unknown as Feature[];

    const resolved = resolveSelectedTestId({
      nextTree,
      featureRows: rows,
      preferredFeatureId: 'f1',
      preferredTestId: 't3',
      selectedTestId: 't1',
    });

    expect(resolved).toBe('t3');
  });

  it('falls back to first test in preferred feature when current selection is missing', () => {
    const resolved = resolveSelectedTestId({
      nextTree: {
        f1: [{ id: 't11' }, { id: 't12' }],
      } as unknown as Record<string, TestCase[]>,
      featureRows: [{ id: 'f1' }] as unknown as Feature[],
      preferredFeatureId: 'f1',
      selectedTestId: 'missing',
    });

    expect(resolved).toBe('t11');
  });

  it('returns empty id when there are no tests', () => {
    const resolved = resolveSelectedTestId({
      nextTree: {},
      featureRows: [],
      preferredFeatureId: 'f1',
      selectedTestId: 'missing',
    });

    expect(resolved).toBe('');
  });
});
