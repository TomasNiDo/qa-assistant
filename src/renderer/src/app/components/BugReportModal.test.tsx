import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedBugReport, Run, StepResult } from '@shared/types';
import { BugReportModal } from './BugReportModal';

const baseBugReport: GeneratedBugReport = {
  title: 'Login redirect mismatch',
  environment: 'staging',
  stepsToReproduce: ['Open /login', 'Submit valid credentials', 'Expect /dashboard URL'],
  expectedResult: 'User lands on /dashboard',
  actualResult: 'User remains on /login?error=invalid',
  evidence: ['/tmp/step-1.png'],
};

const baseRun: Run = {
  id: 'run-12345678abcd',
  testCaseId: 'test-1',
  browser: 'chromium',
  status: 'failed',
  startedAt: '2026-02-20T09:11:00.000Z',
  endedAt: '2026-02-20T09:11:30.000Z',
};

const baseStepResults: StepResult[] = [
  {
    id: 'result-1',
    runId: 'run-12345678abcd',
    stepId: 'step-1',
    stepOrder: 1,
    stepRawText: 'Open /login',
    status: 'passed',
    errorText: null,
    screenshotPath: '/tmp/step-1.png',
  },
  {
    id: 'result-2',
    runId: 'run-12345678abcd',
    stepId: 'step-2',
    stepOrder: 2,
    stepRawText: 'Expect /dashboard URL',
    status: 'failed',
    errorText: "Expected URL to match /dashboard/\nReceived: '/login?error=invalid'\nat line 7",
    screenshotPath: '/tmp/step-2.png',
  },
];

describe('BugReportModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function installQaApiMocks(overrides: Partial<typeof window.qaApi> = {}) {
    const runGetScreenshotThumbnailDataUrl = vi.fn(async () => ({
      ok: true as const,
      data: 'data:image/jpeg;base64,THUMB',
    }));
    const runGetScreenshotDataUrl = vi.fn(async () => ({
      ok: true as const,
      data: 'data:image/png;base64,FULL',
    }));
    const copyImageToClipboard = vi.fn(async () => ({
      ok: true as const,
      data: true,
    }));

    const qaApi = {
      runGetScreenshotThumbnailDataUrl,
      runGetScreenshotDataUrl,
      copyImageToClipboard,
      ...overrides,
    };

    Object.defineProperty(window, 'qaApi', {
      configurable: true,
      value: qaApi,
    });

    return {
      runGetScreenshotThumbnailDataUrl,
      runGetScreenshotDataUrl,
      copyImageToClipboard,
    };
  }

  it('renders modal sections and keeps export/create issue disabled', () => {
    installQaApiMocks();

    render(
      <BugReportModal
        bugReport={baseBugReport}
        fullReportText="Title: Login redirect mismatch"
        selectedRun={baseRun}
        stepResults={[]}
        testCaseTitle="Login with valid credentials"
        onClose={vi.fn()}
        onCopyFullReport={vi.fn(async () => undefined)}
        onMessage={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Bug Report' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Environment' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Error Details' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Screenshots' })).toBeTruthy();
    expect(screen.getByText('No failed step available')).toBeTruthy();
    expect(screen.getByText('No screenshots were captured for this run.')).toBeTruthy();

    expect((screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Create Issue' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('supports copy actions for summary/error/screenshots/full report', async () => {
    const qaApi = installQaApiMocks();

    const onMessage = vi.fn();
    const onCopyFullReport = vi.fn(async () => undefined);
    const write = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText, write },
    });
    const ClipboardItemMock = vi.fn().mockImplementation((item) => item);
    (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem =
      ClipboardItemMock as unknown as typeof ClipboardItem;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <BugReportModal
        bugReport={baseBugReport}
        fullReportText="Title: Login redirect mismatch"
        selectedRun={baseRun}
        stepResults={baseStepResults}
        testCaseTitle="Login with valid credentials"
        onClose={vi.fn()}
        onCopyFullReport={onCopyFullReport}
        onMessage={onMessage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy error details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy all screenshot references' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy screenshot image for step 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Full Report' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(3);
      expect(qaApi.copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,FULL');
      expect(onCopyFullReport).toHaveBeenCalledTimes(1);
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    expect(onMessage).toHaveBeenCalledWith('Summary copied to clipboard.');
    expect(onMessage).toHaveBeenCalledWith('Error details copied to clipboard.');
    expect(onMessage).toHaveBeenCalledWith('Screenshot references copied to clipboard.');
    expect(onMessage).toHaveBeenCalledWith('Step 1 image copied to clipboard.');
  });

  it('opens screenshot viewer, supports zoom/copy controls, and closes on Escape', async () => {
    const qaApi = installQaApiMocks();

    const write = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    const ClipboardItemMock = vi.fn().mockImplementation((item) => item);
    (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem =
      ClipboardItemMock as unknown as typeof ClipboardItem;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const onMessage = vi.fn();
    const onClose = vi.fn();
    render(
      <BugReportModal
        bugReport={baseBugReport}
        fullReportText="Title: Login redirect mismatch"
        selectedRun={baseRun}
        stepResults={baseStepResults}
        testCaseTitle="Login with valid credentials"
        onClose={onClose}
        onCopyFullReport={vi.fn(async () => undefined)}
        onMessage={onMessage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open screenshot for step 1' }));

    expect(await screen.findByRole('dialog', { name: 'Step 1 screenshot' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Copy image' }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.wheel(window, { deltaY: -120, ctrlKey: true });
    expect(screen.getByText('120%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));
    await waitFor(() => {
      expect(qaApi.copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,FULL');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith('Image copied to clipboard.');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Step 1 screenshot' })).toBeNull();
    });
    expect(onClose).toHaveBeenCalledTimes(0);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to native clipboard copy when browser clipboard permission is denied', async () => {
    const copyImageToClipboard = vi.fn(async () => ({
      ok: true as const,
      data: true,
    }));
    installQaApiMocks({ copyImageToClipboard });

    const write = vi.fn(async () => {
      throw new Error("Failed to execute 'write' on 'Clipboard': Write permission denied.");
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    const ClipboardItemMock = vi.fn().mockImplementation((item) => item);
    (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem =
      ClipboardItemMock as unknown as typeof ClipboardItem;

    const onMessage = vi.fn();
    render(
      <BugReportModal
        bugReport={baseBugReport}
        fullReportText="Title: Login redirect mismatch"
        selectedRun={baseRun}
        stepResults={baseStepResults}
        testCaseTitle="Login with valid credentials"
        onClose={vi.fn()}
        onCopyFullReport={vi.fn(async () => undefined)}
        onMessage={onMessage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy screenshot image for step 1' }));

    await waitFor(() => {
      expect(copyImageToClipboard).toHaveBeenCalledWith('data:image/png;base64,FULL');
    });
    expect(onMessage).toHaveBeenCalledWith('Step 1 image copied to clipboard.');
  });

  it('reports copy failure when native bridge is unavailable and browser clipboard is denied', async () => {
    installQaApiMocks({ copyImageToClipboard: undefined });

    const write = vi.fn(async () => {
      throw new Error("Failed to execute 'write' on 'Clipboard': Write permission denied.");
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    const ClipboardItemMock = vi.fn().mockImplementation((item) => item);
    (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem =
      ClipboardItemMock as unknown as typeof ClipboardItem;

    const onMessage = vi.fn();
    render(
      <BugReportModal
        bugReport={baseBugReport}
        fullReportText="Title: Login redirect mismatch"
        selectedRun={baseRun}
        stepResults={baseStepResults}
        testCaseTitle="Login with valid credentials"
        onClose={vi.fn()}
        onCopyFullReport={vi.fn(async () => undefined)}
        onMessage={onMessage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy screenshot image for step 1' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to copy image to clipboard. Native clipboard failed: Native clipboard bridge is unavailable.'),
      );
    });
  });
});
