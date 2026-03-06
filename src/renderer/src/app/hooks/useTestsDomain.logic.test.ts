import { describe, expect, it } from 'vitest';
import type { Feature, TestCase } from '@shared/types';
import {
  applyCodeDraftUpdate,
  applyRestoreGeneratedCode,
  formatCustomCodeSyntaxError,
  getCustomCodeError,
  getStepParseErrors,
  getStepParseWarnings,
  resolveSelectedTestId,
} from './useTestsDomain';

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

  it('builds validation errors from parse previews', () => {
    const errors = getStepParseErrors(
      ['Click "Login"', 'Expect dashboard'],
      [
        { ok: true, action: { type: 'click', target: 'Login' }, source: 'strict', warnings: [] },
        { ok: false, error: 'Bad syntax' },
      ],
      false,
    );

    expect(errors).toEqual([null, 'Bad syntax']);
  });

  it('marks missing previews as validating while in-flight', () => {
    const errors = getStepParseErrors(['Click "Login"'], [], true);
    expect(errors).toEqual(['Validating step...']);
  });

  it('returns per-line parse warnings for successful parsed steps', () => {
    const warnings = getStepParseWarnings(
      ['Enter "product1" in "Search" field'],
      [
        {
          ok: true,
          action: { type: 'enter', target: 'Search', value: 'product1' },
          source: 'strict',
          warnings: [
            {
              code: 'ambiguous_target',
              message: 'Target lookup is ambiguous.',
              suggestedStep: 'Enter "product1" in "Search" field using placeholder',
            },
          ],
        },
      ],
    );

    expect(warnings).toEqual([
      [
        {
          code: 'ambiguous_target',
          message: 'Target lookup is ambiguous.',
          suggestedStep: 'Enter "product1" in "Search" field using placeholder',
        },
      ],
    ]);
  });

  it('formats syntax validation messages from main process result', () => {
    expect(
      formatCustomCodeSyntaxError({
        valid: false,
        line: 5,
        message: "Custom code syntax error at line 5: Unexpected token ','",
      }),
    ).toBe("Custom code syntax error at line 5: Unexpected token ','");
    expect(
      formatCustomCodeSyntaxError({
        valid: false,
        line: null,
        message: null,
      }),
    ).toBe('Custom code syntax is invalid.');
    expect(
      formatCustomCodeSyntaxError({
        valid: true,
        line: null,
        message: null,
      }),
    ).toBeNull();
  });

  it('prefers empty-custom-code message over syntax diagnostics', () => {
    expect(
      getCustomCodeError(true, '', "Custom code syntax error at line 1: Unexpected token ','"),
    ).toBe('Custom code cannot be empty when customization is enabled.');
    expect(
      getCustomCodeError(
        true,
        'await page.getByRole("button").click();',
        "Custom code syntax error at line 1: Unexpected token ','",
      ),
    ).toBe("Custom code syntax error at line 1: Unexpected token ','");
    expect(
      getCustomCodeError(false, 'await page.getByRole("button").click();', 'some syntax error'),
    ).toBeNull();
  });

  it('updates custom code draft even without edit-enable gate', () => {
    const base = {
      id: 't1',
      title: 'Login flow',
      testType: 'positive',
      priority: 'medium',
      isAiGenerated: false,
      stepsText: 'Click "Login"',
      generatedCode: 'await page.goto("/login");',
      customCode: '',
      isCustomized: false,
      activeView: 'code',
    } as const;

    const diverged = applyCodeDraftUpdate(base, 'await page.goto("/custom-login");');
    expect(diverged.isCustomized).toBe(true);
    expect(diverged.customCode).toBe('await page.goto("/custom-login");');

    const synced = applyCodeDraftUpdate(base, base.generatedCode);
    expect(synced.isCustomized).toBe(false);
    expect(synced.customCode).toBe('');
  });

  it('restores generated code by clearing customization state only', () => {
    const restored = applyRestoreGeneratedCode({
      id: 't1',
      title: 'Login flow',
      testType: 'positive',
      priority: 'medium',
      isAiGenerated: false,
      stepsText: 'Click "Login"',
      generatedCode: 'await page.goto("/login");',
      customCode: 'await page.goto("/custom-login");',
      isCustomized: true,
      activeView: 'code',
    });

    expect(restored.isCustomized).toBe(false);
    expect(restored.customCode).toBe('');
    expect(restored.generatedCode).toBe('await page.goto("/login");');
  });
});
