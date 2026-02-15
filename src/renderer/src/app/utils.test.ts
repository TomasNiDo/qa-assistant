import { describe, expect, it } from 'vitest';
import type { GeneratedBugReport, Run } from '@shared/types';
import { formatBugReport, formatRunDuration, parseStepLines, validateBaseUrl } from './utils';

describe('app utils', () => {
  it('validates base urls with required protocol', () => {
    expect(validateBaseUrl('https://example.com')).toBeNull();
    expect(validateBaseUrl('')).toBe('Base URL is required.');
    expect(validateBaseUrl('example.com')).toBe('Base URL must be a valid URL including protocol (https://...).');
  });

  it('parses step lines by trimming and removing empty rows', () => {
    expect(parseStepLines('  Click "Login"\n\n Enter "abc" in "Email" field  \n')).toEqual([
      'Click "Login"',
      'Enter "abc" in "Email" field',
    ]);
  });

  it('formats bug reports deterministically', () => {
    const report: GeneratedBugReport = {
      title: 'Checkout fails',
      environment: 'local',
      stepsToReproduce: ['Open checkout', 'Submit card'],
      expectedResult: 'Order succeeds',
      actualResult: '500 error appears',
      evidence: ['run-123', 'step-2 screenshot'],
    };

    expect(formatBugReport(report)).toBe(
      [
        'Title: Checkout fails',
        'Environment: local',
        '',
        'Steps to Reproduce:',
        '1. Open checkout',
        '2. Submit card',
        '',
        'Expected Result: Order succeeds',
        'Actual Result: 500 error appears',
        '',
        'Evidence:',
        '- run-123',
        '- step-2 screenshot',
      ].join('\n'),
    );
  });

  it('formats run duration from start/end timestamps', () => {
    const run: Run = {
      id: 'run-1',
      testCaseId: 'test-1',
      browser: 'chromium',
      status: 'passed',
      startedAt: '2026-02-01T00:00:00.000Z',
      endedAt: '2026-02-01T00:00:03.400Z',
    };

    expect(formatRunDuration(run)).toBe('3.4s');
  });
});
