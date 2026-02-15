import { describe, expect, it } from 'vitest';
import type { Project, TestCase } from '@shared/types';
import { getStepParseErrors, resolveSelectedTestId } from './useTestsDomain';

describe('useTestsDomain logic helpers', () => {
  it('prefers explicit preferredTestId when present', () => {
    const nextTree = {
      p1: [{ id: 't1' }, { id: 't2' }],
      p2: [{ id: 't3' }],
    } as unknown as Record<string, TestCase[]>;
    const rows = [{ id: 'p1' }, { id: 'p2' }] as unknown as Project[];

    const resolved = resolveSelectedTestId({
      nextTree,
      projectRows: rows,
      preferredProjectId: 'p1',
      preferredTestId: 't3',
      selectedTestId: 't1',
    });

    expect(resolved).toBe('t3');
  });

  it('falls back to first test in preferred project when current selection is missing', () => {
    const resolved = resolveSelectedTestId({
      nextTree: {
        p1: [{ id: 't11' }, { id: 't12' }],
      } as unknown as Record<string, TestCase[]>,
      projectRows: [{ id: 'p1' }] as unknown as Project[],
      preferredProjectId: 'p1',
      selectedTestId: 'missing',
    });

    expect(resolved).toBe('t11');
  });

  it('returns empty id when there are no tests', () => {
    const resolved = resolveSelectedTestId({
      nextTree: {},
      projectRows: [],
      preferredProjectId: 'p1',
      selectedTestId: 'missing',
    });

    expect(resolved).toBe('');
  });

  it('builds validation errors from parse previews', () => {
    const errors = getStepParseErrors(
      ['Click "Login"', 'Expect dashboard'],
      [{ ok: true, action: { type: 'click', target: 'Login' }, source: 'strict' }, { ok: false, error: 'Bad syntax' }],
      false,
    );

    expect(errors).toEqual([null, 'Bad syntax']);
  });

  it('marks missing previews as validating while in-flight', () => {
    const errors = getStepParseErrors(['Click "Login"'], [], true);
    expect(errors).toEqual(['Validating step...']);
  });
});
