import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GeneratedBugReport } from '@shared/types';
import { useBugReportDomain } from './useBugReportDomain';

const generatedBugReport: GeneratedBugReport = {
  title: 'Login redirect mismatch',
  environment: 'staging',
  stepsToReproduce: ['Open /login', 'Submit valid credentials'],
  expectedResult: 'User lands on dashboard',
  actualResult: 'User remains on login page',
  evidence: ['/tmp/step-2.png'],
};

describe('useBugReportDomain', () => {
  it('generates bug report and stores a formatted draft', async () => {
    const aiGenerateBugReport = vi.fn(async () => ({ ok: true as const, data: generatedBugReport }));
    Object.defineProperty(window, 'qaApi', {
      configurable: true,
      value: {
        aiGenerateBugReport,
      },
    });

    const onMessage = vi.fn();
    const { result } = renderHook(() => useBugReportDomain({ onMessage }));

    await act(async () => {
      await result.current.generateBugReport('run-1');
    });

    expect(aiGenerateBugReport).toHaveBeenCalledWith({ runId: 'run-1' });
    expect(result.current.bugReport).toEqual(generatedBugReport);
    expect(result.current.bugReportDraft).toContain('Title: Login redirect mismatch');
    expect(onMessage).toHaveBeenCalledWith('Bug report generated.');
  });

  it('copies bug report draft and can clear state', async () => {
    const aiGenerateBugReport = vi.fn(async () => ({ ok: true as const, data: generatedBugReport }));
    Object.defineProperty(window, 'qaApi', {
      configurable: true,
      value: {
        aiGenerateBugReport,
      },
    });

    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const onMessage = vi.fn();
    const { result } = renderHook(() => useBugReportDomain({ onMessage }));

    await act(async () => {
      await result.current.generateBugReport('run-2');
      await result.current.copyBugReport();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith('Bug report copied to clipboard.');

    act(() => {
      result.current.closeBugReportDraft();
    });

    expect(result.current.bugReport).toBeNull();
    expect(result.current.bugReportDraft).toBe('');
  });
});
