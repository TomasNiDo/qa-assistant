import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QaAssistantApi } from '@shared/ipc';
import type { Run, StepResult } from '@shared/types';
import { RunCenterPanel } from './RunCenterPanel';

const { loadFullScreenshotMock } = vi.hoisted(() => ({
  loadFullScreenshotMock: vi.fn(async () => ({ ok: true as const, dataUrl: 'data:image/png;base64,FULL' })),
}));

vi.mock('../../screenshotLoader', () => ({
  loadFullScreenshot: loadFullScreenshotMock,
}));

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

const stepResultsWithScreenshot: StepResult[] = [
  {
    id: 'result-2',
    runId: 'run-2',
    stepId: 'step-2',
    stepOrder: 2,
    stepRawText: 'Click checkout',
    status: 'failed',
    errorText: 'Expected checkout to open',
    screenshotPath: '/tmp/step-2.png',
  },
];

describe('RunCenterPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    loadFullScreenshotMock.mockResolvedValue({ ok: true as const, dataUrl: 'data:image/png;base64,FULL' });
  });

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
        onRerun={vi.fn()}
        canRerun
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
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Immediately' }));
    expect(onCancelRun).toHaveBeenCalledTimes(1);
  });

  it('reflects report bug button enabled state from props', () => {
    const { rerender } = render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-2"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[1]}
        stepResults={stepResults}
        activeRunId=""
        onCancelRun={vi.fn()}
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport={false}
      />,
    );

    expect((screen.getByRole('button', { name: 'Report Bug' }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-2"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[1]}
        stepResults={stepResults}
        activeRunId=""
        onCancelRun={vi.fn()}
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport
      />,
    );

    expect((screen.getByRole('button', { name: 'Report Bug' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows generating label while bug report generation is running', () => {
    render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-2"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[1]}
        stepResults={stepResults}
        activeRunId=""
        onCancelRun={vi.fn()}
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport
        canGenerateBugReport
      />,
    );

    expect(screen.getByRole('button', { name: 'Generating...' })).toBeTruthy();
  });

  it('uses success color for current run progress when selected run passed', () => {
    render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-1"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[0]}
        stepResults={stepResults}
        activeRunId=""
        onCancelRun={vi.fn()}
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport
      />,
    );

    const progressFill = screen.getByTestId('current-run-progress-fill');
    expect(progressFill.className).toContain('bg-success');
    expect(progressFill.className).not.toContain('bg-danger');
  });

  it('supports screenshot viewer zoom controls, ctrl/cmd wheel zoom, copy image, and escape close', async () => {
    const copyImageToClipboard = vi.fn(async () => ({ ok: true as const, data: true }));
    Object.defineProperty(window, 'qaApi', {
      configurable: true,
      value: {
        copyImageToClipboard,
      } as unknown as QaAssistantApi,
    });
    const write = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });

    render(
      <RunCenterPanel
        runs={runs}
        selectedRunId="run-2"
        setSelectedRunId={vi.fn()}
        selectedRun={runs[1]}
        stepResults={stepResultsWithScreenshot}
        activeRunId=""
        onCancelRun={vi.fn()}
        onRerun={vi.fn()}
        canRerun
        onGenerateBugReport={vi.fn()}
        isGeneratingBugReport={false}
        canGenerateBugReport
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open screenshot for step 2' }));

    expect(await screen.findByRole('dialog', { name: 'Step 2 screenshot' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();

    fireEvent.wheel(screen.getByLabelText('Screenshot viewer canvas'), { deltaY: -120, ctrlKey: true });
    expect(screen.getByText('120%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));
    await waitFor(() => {
      expect(copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,FULL');
    });
    expect(screen.getByText('Image copied.')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Step 2 screenshot' })).toBeNull();
    });
  });
});
