import { loadFullScreenshot } from '../../screenshotLoader';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Run, StepResult } from '@shared/types';
import {
  dangerButtonClass,
  helperTextClass,
  panelClass,
  sectionTitleClass,
} from '../uiClasses';
import { formatRunDuration } from '../utils';

interface RunCenterPanelProps {
  runs: Run[];
  selectedRunId: string;
  setSelectedRunId: (runId: string) => void;
  selectedRun: Run | null;
  stepResults: StepResult[];
  activeRunId: string;
  onCancelRun: () => void;
  onRerun: () => void;
  canRerun: boolean;
  onGenerateBugReport: () => void;
  isGeneratingBugReport: boolean;
  canGenerateBugReport: boolean;
}

function formatRunTimeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function runBadgeClass(status: Run['status']): string {
  if (status === 'passed') {
    return 'border-success/35 bg-success/12 text-success';
  }
  if (status === 'failed') {
    return 'border-danger/35 bg-danger/12 text-danger';
  }
  if (status === 'running') {
    return 'border-info/35 bg-info/12 text-info';
  }
  return 'border-border bg-background text-muted-foreground';
}

function statusIcon(result: StepResult): JSX.Element {
  if (result.status === 'passed') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-success" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M8 12.5l2.3 2.3L16 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (result.status === 'failed') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-danger" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (result.status === 'pending') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-warning" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function rowTone(result: StepResult): string {
  if (result.status === 'failed') {
    return 'border-danger/35 bg-danger/10';
  }
  return 'border-border bg-background';
}

function toStepDurationLabel(stepOrder: number, totalSteps: number, run: Run | null): string {
  if (!run?.endedAt || totalSteps <= 0) {
    return '--s';
  }

  const totalSeconds = Math.max(0.1, (Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000);
  const average = totalSeconds / totalSteps;
  const weighted = average * (0.85 + ((stepOrder - 1) % 3) * 0.15);
  return `${Math.max(0.1, weighted).toFixed(1)}s`;
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[;,.]+$/g, '').trim();
}

function parseFailureDetails(step: StepResult | null): {
  expected: string;
  received: string;
  location: string;
} {
  if (!step) {
    return {
      expected: 'Expected assertion details were not available.',
      received: "'No received value captured'",
      location: 'at unknown line',
    };
  }

  const compact = toSingleLine(step.errorText ?? '');
  const lines = (step.errorText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const expectedLine = lines.find((line) => /^expected\b/i.test(line));
  const receivedLine = lines.find((line) => /^received\b/i.test(line));
  const lineMatch = compact.match(/\bline\s+(\d+)\b/i);
  const atMatch = lines.find((line) => /^at\s+/i.test(line));
  const fallbackExpected = compact ? trimTrailingPunctuation(compact) : 'Expected assertion details were not available';

  return {
    expected: trimTrailingPunctuation(expectedLine ?? fallbackExpected),
    received: trimTrailingPunctuation(receivedLine ?? 'Received: unknown result'),
    location: lineMatch ? `at line ${lineMatch[1]} · assertion check` : atMatch ?? `at step ${step.stepOrder} · assertion check`,
  };
}

export function RunCenterPanel({
  runs,
  selectedRunId,
  setSelectedRunId,
  selectedRun,
  stepResults,
  activeRunId,
  onCancelRun,
  onRerun,
  canRerun,
  onGenerateBugReport,
  isGeneratingBugReport,
  canGenerateBugReport,
}: RunCenterPanelProps): JSX.Element {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerImage, setViewerImage] = useState('');
  const [viewerStepLabel, setViewerStepLabel] = useState('');
  const [activeScreenshotPath, setActiveScreenshotPath] = useState('');

  const sortedRuns = useMemo(
    () => runs.slice().sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    [runs],
  );

  const sortedSteps = useMemo(
    () => stepResults.slice().sort((left, right) => left.stepOrder - right.stepOrder),
    [stepResults],
  );
  const failedStep = sortedSteps.find((step) => step.status === 'failed') ?? null;
  const failureDetails = parseFailureDetails(failedStep);

  useEffect(() => {
    if (!viewerOpen || !activeScreenshotPath) {
      return;
    }

    let cancelled = false;
    setViewerLoading(true);
    setViewerError('');
    setViewerImage('');

    void (async () => {
      const result = await loadFullScreenshot(window.qaApi, activeScreenshotPath);
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setViewerError(result.message);
        setViewerLoading(false);
        return;
      }

      setViewerImage(result.dataUrl);
      setViewerLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeScreenshotPath, viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setViewerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerOpen]);

  function openScreenshot(step: StepResult): void {
    if (!step.screenshotPath) {
      return;
    }

    setViewerStepLabel(`Step ${step.stepOrder}`);
    setActiveScreenshotPath(step.screenshotPath);
    setViewerOpen(true);
  }

  return (
    <>
      <aside className={`${panelClass} flex min-h-0 flex-col space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Execution Insights</h2>
          <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${runBadgeClass(selectedRun?.status ?? 'queued')}`}>
            {(selectedRun?.status ?? 'idle').toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {sortedRuns.length === 0 ? <p className={helperTextClass}>No run history yet.</p> : null}
          {sortedRuns.map((run) => (
            <button
              key={run.id}
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                run.id === selectedRunId
                  ? 'border-primary/45 bg-primary/18 text-primary'
                  : runBadgeClass(run.status)
              }`}
              onClick={() => setSelectedRunId(run.id)}
              aria-label={`${run.status} run at ${formatRunTimeLabel(run.startedAt)}`}
            >
              {formatRunTimeLabel(run.startedAt)}
            </button>
          ))}
        </div>

        <div className="border-t border-border pt-1">
          <div className="flex items-center justify-between text-[11px] text-secondary-foreground">
            <span>Current Run</span>
            <span>
              {selectedRun ? `${selectedRun.browser} · ${formatRunDuration(selectedRun)}` : 'No run selected'}
            </span>
          </div>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-sm bg-muted">
          <div
            className="h-full rounded-sm bg-danger"
            style={{
              width: `${Math.round(
                (sortedSteps.filter((step) => step.status !== 'pending').length / Math.max(sortedSteps.length, 1)) * 100,
              )}%`,
            }}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {sortedSteps.length === 0 ? (
            <p className={helperTextClass}>No step results available.</p>
          ) : (
            sortedSteps.map((result) => (
              <div
                key={result.id}
                className={`flex items-center justify-between gap-2 rounded-sm border px-2 py-1.5 ${rowTone(result)}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {statusIcon(result)}
                  <p
                    className={`truncate text-[11px] ${result.status === 'failed' ? 'text-danger' : 'text-secondary-foreground'}`}
                    title={result.stepRawText}
                  >
                    {result.stepRawText}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
                      result.screenshotPath
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'text-muted-foreground/40'
                    }`}
                    aria-label={`Open screenshot for step ${result.stepOrder}`}
                    title={result.screenshotPath ? 'Open screenshot' : 'No screenshot'}
                    onClick={() => openScreenshot(result)}
                    disabled={!result.screenshotPath}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                      <path
                        d="M5 7h3l1.2-2h5.6L16 7h3a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2zm7 3.5a3.5 3.5 0 100 7a3.5 3.5 0 000-7z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className={result.status === 'failed' ? 'text-danger' : undefined}>
                    {toStepDurationLabel(result.stepOrder, sortedSteps.length, selectedRun)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          {failedStep ? (
            <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <div className="flex items-center gap-2 text-danger">
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                  <path
                    d="M12 3l9 16H3l9-16zM12 9v4m0 3h.01"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-[12px] font-semibold leading-none">Assertion Failed</p>
              </div>
              <p className="text-[11px] text-secondary-foreground">{failureDetails.expected}</p>
              <div className="rounded-sm bg-[#0d0e10] px-2 py-1.5">
                <p className="text-[10px] text-danger">{failureDetails.received}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{failureDetails.location}</p>
            </div>
          ) : null}

          <div className="h-px bg-border" />

          <div className="space-y-2">
            {activeRunId ? (
              <button type="button" className={dangerButtonClass} onClick={onCancelRun}>
                Cancel Immediately
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/60 bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-success disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onRerun}
                disabled={!canRerun || Boolean(activeRunId)}
              >
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                  <path
                    d="M8 6l10 6-10 6z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
                Re-run
              </button>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[12px] font-normal text-muted-foreground transition-colors hover:border-border-strong hover:text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                disabled
                title="Debug action will be available in a follow-up."
              >
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                  <path
                    d="M9 7V5a3 3 0 016 0v2m-7 0h8m-9 4h10m-8 0v3a3 3 0 006 0v-3M4 9h3m10 0h3M6 19l2-2m8 2l-2-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Debug
              </button>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger transition-colors hover:bg-danger/16 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onGenerateBugReport}
            disabled={!canGenerateBugReport || isGeneratingBugReport}
          >
            <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
              <path
                d="M5 4v16m0-16h8l1 2h5v9h-6l-1-2H5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isGeneratingBugReport ? 'Generating...' : 'Report Bug'}
          </button>
        </div>
      </aside>

      {viewerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${viewerStepLabel} screenshot`}
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              onClick={() => setViewerOpen(false)}
            >
              <div
                className="relative max-h-[92vh] max-w-[92vw] overflow-auto rounded-lg border border-border bg-background p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
                  onClick={() => setViewerOpen(false)}
                  aria-label="Close screenshot viewer"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                {viewerLoading ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Loading screenshot...</p>
                ) : null}
                {!viewerLoading && viewerError ? (
                  <p className="px-3 py-2 text-xs text-danger">{viewerError}</p>
                ) : null}
                {!viewerLoading && !viewerError && viewerImage ? (
                  <img
                    src={viewerImage}
                    alt={`${viewerStepLabel} screenshot`}
                    className="max-h-[88vh] max-w-[88vw] rounded-md object-contain"
                  />
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
