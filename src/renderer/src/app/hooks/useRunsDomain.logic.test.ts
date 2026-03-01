import { describe, expect, it } from 'vitest';
import type { RunUpdateEvent } from '@shared/types';
import { deriveRunUpdateEffects, shouldNotifyForRunUpdate } from './useRunsDomain';

describe('useRunsDomain logic helpers', () => {
  it('refreshes run and steps when run starts', () => {
    const update: RunUpdateEvent = {
      runId: 'run-1',
      type: 'run-started',
      timestamp: '2026-02-01T00:00:00.000Z',
    };

    expect(deriveRunUpdateEffects(update, 'run-0', '')).toEqual({
      nextSelectedRunId: 'run-1',
      clearActiveRunId: false,
      refreshRuns: true,
      refreshStepResults: true,
      refreshBrowserStates: false,
      refreshActiveRunContext: true,
    });
  });

  it('refreshes only runs for step events on unrelated runs', () => {
    const update: RunUpdateEvent = {
      runId: 'run-2',
      type: 'step-finished',
      timestamp: '2026-02-01T00:00:00.000Z',
      stepId: 'step-1',
      stepOrder: 1,
    };

    expect(deriveRunUpdateEffects(update, 'run-1', 'run-3')).toEqual({
      clearActiveRunId: false,
      refreshRuns: true,
      refreshStepResults: false,
      refreshBrowserStates: false,
      refreshActiveRunContext: false,
    });
  });

  it('clears active run and refreshes context on run finish', () => {
    const update: RunUpdateEvent = {
      runId: 'run-3',
      type: 'run-finished',
      timestamp: '2026-02-01T00:00:00.000Z',
      runStatus: 'failed',
    };

    expect(deriveRunUpdateEffects(update, 'run-3', 'run-3')).toEqual({
      clearActiveRunId: true,
      refreshRuns: true,
      refreshStepResults: true,
      refreshBrowserStates: true,
      refreshActiveRunContext: true,
    });
  });

  it('only notifies for run-level updates', () => {
    const runStarted: RunUpdateEvent = {
      runId: 'run-1',
      type: 'run-started',
      timestamp: '2026-02-01T00:00:00.000Z',
      message: 'Running 2 step(s).',
    };
    const stepFinished: RunUpdateEvent = {
      runId: 'run-1',
      type: 'step-finished',
      timestamp: '2026-02-01T00:00:01.000Z',
      stepId: 'step-1',
      stepOrder: 1,
      stepStatus: 'failed',
      message: 'Locator timeout',
    };
    const runFinished: RunUpdateEvent = {
      runId: 'run-1',
      type: 'run-finished',
      timestamp: '2026-02-01T00:00:02.000Z',
      runStatus: 'failed',
      message: 'Locator timeout',
    };

    expect(shouldNotifyForRunUpdate(runStarted)).toBe(true);
    expect(shouldNotifyForRunUpdate(stepFinished)).toBe(false);
    expect(shouldNotifyForRunUpdate(runFinished)).toBe(true);
  });
});
