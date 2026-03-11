import { useEffect, useMemo, useState, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedBugReport, Run, StepResult } from '@shared/types';
import { loadFullScreenshot, loadThumbnailWithFallback } from '../../screenshotLoader';
import { copyImageSourceToClipboard, copyTextToClipboard, formatRunDuration, parseFailureDetails, toErrorMessage } from '../utils';

const MAX_SCREENSHOT_THUMBNAILS = 5;
const SCREENSHOT_VIEWER_MIN_ZOOM = 0.5;
const SCREENSHOT_VIEWER_MAX_ZOOM = 3;
const SCREENSHOT_VIEWER_ZOOM_STEP = 0.2;

interface BugReportModalProps {
  bugReport: GeneratedBugReport;
  fullReportText: string;
  selectedRun: Run | null;
  stepResults: StepResult[];
  testCaseTitle: string;
  onClose: () => void;
  onCopyFullReport: () => Promise<void>;
  onMessage: (message: string) => void;
}

interface ThumbnailState {
  loading: boolean;
  dataUrl: string;
  error: string;
}

function toRunStatusLabel(status: Run['status']): string {
  if (status === 'failed') {
    return 'FAILED';
  }

  if (status === 'passed') {
    return 'PASSED';
  }

  if (status === 'running') {
    return 'RUNNING';
  }

  if (status === 'cancelled') {
    return 'CANCELLED';
  }

  return 'QUEUED';
}

export function BugReportModal({
  bugReport,
  fullReportText,
  selectedRun,
  stepResults,
  testCaseTitle,
  onClose,
  onCopyFullReport,
  onMessage,
}: BugReportModalProps): JSX.Element {
  const [thumbnailStateByStepId, setThumbnailStateByStepId] = useState<Record<string, ThumbnailState>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerImage, setViewerImage] = useState('');
  const [viewerStepLabel, setViewerStepLabel] = useState('');
  const [activeScreenshotPath, setActiveScreenshotPath] = useState('');
  const [viewerZoom, setViewerZoom] = useState(1);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [copyImageStatus, setCopyImageStatus] = useState('');
  const [copyingStepImageId, setCopyingStepImageId] = useState('');

  const sortedSteps = useMemo(
    () => stepResults.slice().sort((left, right) => left.stepOrder - right.stepOrder),
    [stepResults],
  );
  const failedStep = sortedSteps.find((step) => step.status === 'failed') ?? null;
  const failureDetails = parseFailureDetails(failedStep);
  const failedStepIndex = failedStep ? failedStep.stepOrder - 1 : -1;

  const screenshotSteps = useMemo(
    () => sortedSteps.filter((step) => Boolean(step.screenshotPath)).slice(0, MAX_SCREENSHOT_THUMBNAILS),
    [sortedSteps],
  );

  const summaryTitle = bugReport.title.trim() || 'Untitled bug report';
  const summaryDescription =
    bugReport.actualResult.trim() || failedStep?.errorText?.trim() || 'No detailed failure description available.';
  const summarySteps = bugReport.stepsToReproduce.filter((step) => Boolean(step.trim()));

  const summaryCopyText = [
    `Summary: ${summaryTitle}`,
    `Details: ${summaryDescription}`,
    '',
    'Steps to Reproduce:',
    ...summarySteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');

  const errorDetailsCopyText = [
    `Step: ${failedStep ? `Step ${failedStep.stepOrder} · ${failedStep.stepRawText}` : 'Unavailable'}`,
    `Expected: ${failureDetails.expected}`,
    `Received: ${failureDetails.received}`,
    `Location: ${failureDetails.location}`,
  ].join('\n');

  const screenshotsCopyText = screenshotSteps
    .map((step) => `Step ${step.stepOrder}: ${step.screenshotPath ?? 'Unavailable screenshot path'}`)
    .join('\n');
  const canZoom = Boolean(viewerImage) && !viewerLoading && !viewerError;
  const zoomPercent = Math.round(viewerZoom * 100);

  useEffect(() => {
    if (screenshotSteps.length === 0) {
      setThumbnailStateByStepId({});
      return;
    }

    let cancelled = false;
    setThumbnailStateByStepId(
      Object.fromEntries(
        screenshotSteps.map((step) => [
          step.id,
          {
            loading: true,
            dataUrl: '',
            error: '',
          },
        ]),
      ),
    );

    for (const step of screenshotSteps) {
      const screenshotPath = step.screenshotPath;
      if (!screenshotPath) {
        continue;
      }

      void (async () => {
        try {
          const loaded = await loadThumbnailWithFallback(window.qaApi, screenshotPath, step.stepId);
          if (cancelled) {
            return;
          }

          if (!loaded.ok) {
            setThumbnailStateByStepId((previous) => ({
              ...previous,
              [step.id]: {
                loading: false,
                dataUrl: '',
                error: loaded.message,
              },
            }));
            return;
          }

          setThumbnailStateByStepId((previous) => ({
            ...previous,
            [step.id]: {
              loading: false,
              dataUrl: loaded.dataUrl,
              error: '',
            },
          }));
        } catch (error) {
          if (cancelled) {
            return;
          }

          setThumbnailStateByStepId((previous) => ({
            ...previous,
            [step.id]: {
              loading: false,
              dataUrl: '',
              error: toErrorMessage(error),
            },
          }));
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [screenshotSteps]);

  useEffect(() => {
    if (!viewerOpen || !activeScreenshotPath) {
      return;
    }

    let cancelled = false;
    setViewerLoading(true);
    setViewerError('');
    setViewerImage('');

    void (async () => {
      const loaded = await loadFullScreenshot(window.qaApi, activeScreenshotPath);
      if (cancelled) {
        return;
      }

      if (!loaded.ok) {
        setViewerError(loaded.message);
        setViewerLoading(false);
        return;
      }

      setViewerImage(loaded.dataUrl);
      setViewerLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeScreenshotPath, viewerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (viewerOpen) {
          setViewerOpen(false);
          return;
        }
        onClose();
        return;
      }

      if (!viewerOpen) {
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setViewerZoom((current) => clampViewerZoom(current + SCREENSHOT_VIEWER_ZOOM_STEP));
        return;
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setViewerZoom((current) => clampViewerZoom(current - SCREENSHOT_VIEWER_ZOOM_STEP));
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        setViewerZoom(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) {
      setViewerZoom(1);
      setCopyImageStatus('');
      setIsCopyingImage(false);
    }
  }, [viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }

    const onWheel = (event: globalThis.WheelEvent): void => {
      if ((!event.ctrlKey && !event.metaKey) || !canZoom) {
        return;
      }

      event.preventDefault();
      const delta = event.deltaY < 0 ? SCREENSHOT_VIEWER_ZOOM_STEP : -SCREENSHOT_VIEWER_ZOOM_STEP;
      setViewerZoom((current) => clampViewerZoom(current + delta));
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }, [canZoom, viewerOpen]);

  function openScreenshot(step: StepResult): void {
    if (!step.screenshotPath) {
      return;
    }

    setViewerStepLabel(`Step ${step.stepOrder}`);
    setActiveScreenshotPath(step.screenshotPath);
    setViewerOpen(true);
  }

  async function copyTextWithMessage(text: string, successMessage: string): Promise<void> {
    const copied = await copyTextToClipboard(text);
    onMessage(copied ? successMessage : 'Unable to copy to clipboard.');
  }

  function zoomIn(): void {
    setViewerZoom((current) => clampViewerZoom(current + SCREENSHOT_VIEWER_ZOOM_STEP));
  }

  function zoomOut(): void {
    setViewerZoom((current) => clampViewerZoom(current - SCREENSHOT_VIEWER_ZOOM_STEP));
  }

  function resetZoom(): void {
    setViewerZoom(1);
  }

  function handleViewerWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!canZoom) {
      return;
    }

    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? SCREENSHOT_VIEWER_ZOOM_STEP : -SCREENSHOT_VIEWER_ZOOM_STEP;
    setViewerZoom((current) => clampViewerZoom(current + delta));
  }

  async function copyScreenshotImage(): Promise<void> {
    if (!viewerImage || isCopyingImage) {
      return;
    }

    setIsCopyingImage(true);
    setCopyImageStatus('');

    try {
      await copyImageSourceToClipboard(viewerImage);
      setCopyImageStatus('Image copied.');
      onMessage('Image copied to clipboard.');
    } catch (error) {
      const message = toErrorMessage(error);
      setCopyImageStatus(message);
      onMessage(message);
    } finally {
      setIsCopyingImage(false);
    }
  }

  async function copyStepScreenshotImage(step: StepResult): Promise<void> {
    if (!step.screenshotPath || copyingStepImageId) {
      return;
    }

    setCopyingStepImageId(step.id);
    try {
      const loaded = await loadFullScreenshot(window.qaApi, step.screenshotPath);
      if (!loaded.ok) {
        onMessage(loaded.message);
        return;
      }

      await copyImageSourceToClipboard(loaded.dataUrl);
      onMessage(`Step ${step.stepOrder} image copied to clipboard.`);
    } catch (error) {
      onMessage(toErrorMessage(error));
    } finally {
      setCopyingStepImageId('');
    }
  }

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bug report"
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 px-4 py-8"
      >
        <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <header className="flex items-center justify-between border-b border-border-divider px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10 text-danger">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M12 3l9 16H3l9-16zm0 6v4m0 3h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Bug Report</h2>
                <p className="text-[11px] text-muted-foreground">Auto-generated from failed test run</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
                <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                  <path
                    d="M12 3l2.2 4.5L19 8l-3.5 3.4.8 4.8L12 13.9 7.7 16.2l.8-4.8L5 8l4.8-.5L12 3z"
                    fill="currentColor"
                  />
                </svg>
                AI Generated
              </span>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                onClick={onClose}
                aria-label="Close bug report modal"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary-foreground">Summary</h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  onClick={() => {
                    void copyTextWithMessage(summaryCopyText, 'Summary copied to clipboard.');
                  }}
                  aria-label="Copy summary"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M8 8h10v12H8zM6 4h10v2H8v10H6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copy
                </button>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-input p-3.5">
                <p className="text-[13px] font-semibold leading-[1.45] text-foreground">{summaryTitle}</p>
                <p className="text-[11px] leading-[1.55] text-secondary-foreground">{summaryDescription}</p>
                <div className="h-px bg-border" />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-secondary-foreground">Steps to Reproduce</p>
                  <ul className="space-y-1">
                    {summarySteps.length === 0 ? (
                      <li className="text-[11px] text-muted-foreground">No steps were generated.</li>
                    ) : (
                      summarySteps.map((step, index) => {
                        const isFailedStep = failedStepIndex === index;
                        return (
                          <li key={`${index}-${step}`} className="flex gap-2 text-[11px] leading-[1.45]">
                            <span className={isFailedStep ? 'font-medium text-danger' : 'font-medium text-muted-foreground'}>{index + 1}.</span>
                            <span className={isFailedStep ? 'font-medium text-danger' : 'text-secondary-foreground'}>{step}</span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary-foreground">Environment</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-input px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Browser</p>
                  <p className="text-[10px] font-medium text-foreground">{selectedRun?.browser ?? 'Unknown'}</p>
                </div>
                <div className="rounded-md border border-border bg-input px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Duration</p>
                  <p className="text-[10px] font-medium text-foreground">{selectedRun ? formatRunDuration(selectedRun) : '--s'}</p>
                </div>
                <div className="rounded-md border border-border bg-input px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Test Case</p>
                  <p className="truncate text-[10px] font-medium text-foreground" title={testCaseTitle || 'Unknown test case'}>
                    {testCaseTitle || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-input px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Run</p>
                  <p className="text-[10px] font-medium text-foreground">
                    {selectedRun ? `${toRunStatusLabel(selectedRun.status)} · ${selectedRun.id.slice(0, 8)}` : 'Unavailable'}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary-foreground">Error Details</h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  onClick={() => {
                    void copyTextWithMessage(errorDetailsCopyText, 'Error details copied to clipboard.');
                  }}
                  aria-label="Copy error details"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M8 8h10v12H8zM6 4h10v2H8v10H6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copy
                </button>
              </div>

              <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/10 p-3">
                <div className="flex items-center gap-2 text-danger">
                  <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                    <path
                      d="M12 3l9 16H3l9-16zM12 9v4m0 3h.01"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-[12px] font-semibold leading-none">
                    {failedStep ? `Step ${failedStep.stepOrder} · ${failedStep.stepRawText}` : 'No failed step available'}
                  </p>
                </div>
                <p className="text-[11px] text-secondary-foreground">{failureDetails.expected}</p>
                <div className="rounded-sm bg-input px-2 py-1.5">
                  <p className="text-[10px] text-danger">{failureDetails.received}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{failureDetails.location}</p>
              </div>
            </section>

            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-secondary-foreground">Screenshots</h3>
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground">
                    {screenshotSteps.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  onClick={() => {
                    if (!screenshotsCopyText) {
                      onMessage('No screenshot paths available to copy.');
                      return;
                    }
                    void copyTextWithMessage(screenshotsCopyText, 'Screenshot references copied to clipboard.');
                  }}
                  aria-label="Copy all screenshot references"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                    <path
                      d="M8 8h10v12H8zM6 4h10v2H8v10H6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Copy All
                </button>
              </div>

              {screenshotSteps.length === 0 ? (
                <div className="rounded-lg border border-border bg-input px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">No screenshots were captured for this run.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                  {screenshotSteps.map((step) => {
                    const thumbnailState = thumbnailStateByStepId[step.id] ?? {
                      loading: true,
                      dataUrl: '',
                      error: '',
                    };

                    return (
                      <article key={step.id} className="space-y-1.5">
                        <button
                          type="button"
                          className="group flex h-[70px] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-input transition-colors hover:border-border-strong"
                          onClick={() => openScreenshot(step)}
                          disabled={!step.screenshotPath}
                          aria-label={`Open screenshot for step ${step.stepOrder}`}
                        >
                          {thumbnailState.loading ? (
                            <p className="px-2 text-center text-[10px] text-muted-foreground">Loading...</p>
                          ) : thumbnailState.error ? (
                            <p className="px-2 text-center text-[10px] text-danger">Unavailable</p>
                          ) : thumbnailState.dataUrl ? (
                            <img
                              src={thumbnailState.dataUrl}
                              alt={`Step ${step.stepOrder} screenshot`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <p className="px-2 text-center text-[10px] text-muted-foreground">No preview</p>
                          )}
                        </button>

                        <div className="flex items-center justify-between gap-1">
                          <p className={`truncate text-[9px] ${step.status === 'failed' ? 'font-medium text-danger' : 'text-muted-foreground'}`}>
                            Step {step.stepOrder}
                          </p>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              void copyStepScreenshotImage(step);
                            }}
                            aria-label={`Copy screenshot image for step ${step.stepOrder}`}
                            disabled={!step.screenshotPath || Boolean(copyingStepImageId)}
                          >
                            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                              <path
                                d="M8 8h10v12H8zM6 4h10v2H8v10H6z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border-divider px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-success/80 bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:border-success hover:bg-success"
                onClick={() => {
                  void onCopyFullReport();
                }}
                disabled={!fullReportText.trim()}
              >
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                  <path
                    d="M9 4h9a2 2 0 012 2v14H9a2 2 0 01-2-2V4zm-5 4h2v10a2 2 0 002 2h8v2H6a2 2 0 01-2-2V8z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Copy Full Report
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[12px] text-muted-foreground opacity-70"
                disabled
                title="Coming soon"
              >
                <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                  <path
                    d="M12 3v11m0 0l4-4m-4 4l-4-4M5 17h14v4H5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Export
              </button>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[12px] text-muted-foreground opacity-70"
              disabled
              title="Coming soon"
            >
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                <path
                  d="M7 17L17 7m0 0H9m8 0v8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Create Issue
            </button>
          </footer>
        </div>
      </div>

      {viewerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${viewerStepLabel} screenshot`}
          className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setViewerOpen(false)}
        >
          <div
            className="relative max-h-[92vh] max-w-[92vw] overflow-auto rounded-lg border border-border bg-background p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
              {copyImageStatus ? (
                <span className="rounded-md border border-border/80 bg-card px-2 py-1 text-[11px] font-medium text-foreground">
                  {copyImageStatus}
                </span>
              ) : null}
              <div className="inline-flex h-9 items-center gap-1 rounded-full border border-border/80 bg-card px-1.5">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={zoomOut}
                  disabled={!canZoom || viewerZoom <= SCREENSHOT_VIEWER_MIN_ZOOM}
                  aria-label="Zoom out"
                >
                  -
                </button>
                <span className="min-w-[54px] text-center text-[11px] font-semibold text-foreground" title="Use Ctrl/Cmd + wheel to zoom">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={zoomIn}
                  disabled={!canZoom || viewerZoom >= SCREENSHOT_VIEWER_MAX_ZOOM}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border border-border/80 bg-card px-2 text-[11px] font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={resetZoom}
                  disabled={!canZoom || viewerZoom === 1}
                  aria-label="Reset zoom"
                >
                  Reset
                </button>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void copyScreenshotImage();
                }}
                disabled={isCopyingImage || viewerLoading || !viewerImage}
              >
                {isCopyingImage ? 'Copying...' : 'Copy image'}
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card text-foreground transition hover:bg-secondary/85"
                onClick={() => setViewerOpen(false)}
                aria-label="Close screenshot viewer"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {viewerLoading ? <p className="px-3 py-2 text-xs text-muted-foreground">Loading screenshot...</p> : null}
            {!viewerLoading && viewerError ? <p className="px-3 py-2 text-xs text-danger">{viewerError}</p> : null}
            {!viewerLoading && !viewerError && viewerImage ? (
              <div
                className="max-h-[88vh] max-w-[88vw] overflow-auto rounded-md"
                onWheel={handleViewerWheel}
              >
                <img
                  src={viewerImage}
                  alt={`${viewerStepLabel} screenshot`}
                  className="max-h-[88vh] max-w-[88vw] rounded-md object-contain"
                  style={{ transform: `scale(${viewerZoom})`, transformOrigin: 'center center' }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}

function clampViewerZoom(value: number): number {
  return Math.min(SCREENSHOT_VIEWER_MAX_ZOOM, Math.max(SCREENSHOT_VIEWER_MIN_ZOOM, value));
}
