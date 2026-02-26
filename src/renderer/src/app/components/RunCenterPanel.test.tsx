import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Run, StepResult } from '@shared/types';
import { RunCenterPanel } from './RunCenterPanel';

const runs: Run[] = [
  {
    id: 'run-1',
    testCaseId: 'test-1',
    browser: 'chromium',
    status: 'passed',
    startedAt: '2026-02-20T09:42:00.000Z',
    endedAt: '2026-02-20T09:42:42.000Z',
  },
  {
    id: 'run-2',
    testCaseId: 'test-1',
    browser: 'firefox',
    status: 'failed',
    startedAt: '2026-02-20T09:11:00.000Z',
    endedAt: '2026-02-20T09:11:30.000Z',
  },
];

const stepResults: StepResult[] = [
  {
    id: 'result-1',
    runId: 'run-1',
    stepId: 'step-1',
    stepOrder: 1,
    stepRawText: 'Open checkout page',
    status: 'passed',
    errorText: null,
    screenshotPath: null,
  },
];

describe('RunCenterPanel', () => {
  it('renders run chips and allows selecting a run', () => {
    const setSelectedRunId = vi.fn();

    render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-1"
        setSelectedRunId={setSelectedRunId}
        selectedRun={runs[0]}
        stepResults={stepResults}
        activeRunId=""
        onCancelRun={vi.fn()}
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /FAIL/i }));
    expect(setSelectedRunId).toHaveBeenCalledWith('run-2');
  });

  it('shows cancel button when a run is active', () => {
    const onCancelRun = vi.fn();

    render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-1"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[0]}
        stepResults={stepResults}
        activeRunId="run-1"
        onCancelRun={onCancelRun}
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Immediately' }));
    expect(onCancelRun).toHaveBeenCalledTimes(1);
  });
});

