import { useEffect, useState, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import type { StepResult } from '@shared/types';
import { loadFullScreenshot, loadThumbnailWithFallback } from '../../screenshotLoader';
import { statusClassName, toErrorMessage } from '../utils';

const SCREENSHOT_VIEWER_MIN_ZOOM = 0.5;
const SCREENSHOT_VIEWER_MAX_ZOOM = 3;
const SCREENSHOT_VIEWER_ZOOM_STEP = 0.2;

interface StepResultCardProps {
  result: StepResult;
}

export function StepResultCard({ result }: StepResultCardProps): JSX.Element {
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState('');
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [fullScreenshotDataUrl, setFullScreenshotDataUrl] = useState('');
  const [isLoadingFullScreenshot, setIsLoadingFullScreenshot] = useState(false);
  const [fullScreenshotError, setFullScreenshotError] = useState('');
  const [isScreenshotViewerOpen, setIsScreenshotViewerOpen] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [copyImageStatus, setCopyImageStatus] = useState('');
  const [viewerZoom, setViewerZoom] = useState(1);

  const canZoom = Boolean(fullScreenshotDataUrl) && !isLoadingFullScreenshot && !fullScreenshotError;
  const zoomPercent = Math.round(viewerZoom * 100);

  useEffect(() => {
    if (!result.screenshotPath) {
      setThumbnailDataUrl('');
      setIsLoadingThumbnail(false);
      setThumbnailError('');
      setFullScreenshotDataUrl('');
      setIsLoadingFullScreenshot(false);
      setFullScreenshotError('');
      setIsScreenshotViewerOpen(false);
      setViewerZoom(1);
      return;
    }

    const screenshotPath = result.screenshotPath;
    let cancelled = false;
    setIsLoadingThumbnail(true);
    setThumbnailError('');
    setFullScreenshotDataUrl('');
    setIsLoadingFullScreenshot(false);
    setFullScreenshotError('');

    void (async () => {
      try {
        const loaded = await loadThumbnailWithFallback(window.qaApi, screenshotPath, result.stepId);
        if (cancelled) {
          return;
        }

        if (!loaded.ok) {
          setThumbnailDataUrl('');
          setThumbnailError(loaded.message);
          return;
        }

        setThumbnailDataUrl(loaded.dataUrl);
        setThumbnailError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setThumbnailDataUrl('');
        setThumbnailError(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoadingThumbnail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [result.screenshotPath, result.stepId]);

  useEffect(() => {
    if (!isScreenshotViewerOpen || !result.screenshotPath || fullScreenshotDataUrl) {
      return;
    }

    const screenshotPath = result.screenshotPath;
    let cancelled = false;
    setIsLoadingFullScreenshot(true);
    setFullScreenshotError('');

    void (async () => {
      try {
        const loaded = await loadFullScreenshot(window.qaApi, screenshotPath);
        if (cancelled) {
          return;
        }

        if (!loaded.ok) {
          setFullScreenshotDataUrl('');
          setFullScreenshotError(loaded.message);
          return;
        }

        setFullScreenshotDataUrl(loaded.dataUrl);
        setFullScreenshotError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFullScreenshotDataUrl('');
        setFullScreenshotError(toErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoadingFullScreenshot(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullScreenshotDataUrl, isScreenshotViewerOpen, result.screenshotPath]);

  useEffect(() => {
    if (!isScreenshotViewerOpen) {
      setFullScreenshotDataUrl('');
      setIsLoadingFullScreenshot(false);
      setFullScreenshotError('');
      setCopyImageStatus('');
      setViewerZoom(1);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsScreenshotViewerOpen(false);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isScreenshotViewerOpen]);

  function zoomIn(): void {
    setViewerZoom((current) => clampViewerZoom(current + SCREENSHOT_VIEWER_ZOOM_STEP));
  }

  function zoomOut(): void {
    setViewerZoom((current) => clampViewerZoom(current - SCREENSHOT_VIEWER_ZOOM_STEP));
  }

  function resetZoom(): void {
    setViewerZoom(1);
  }

  function handleViewerWheel(event: WheelEvent<HTMLDivElement>): void {
    if (!canZoom) {
      return;
    }

    const shouldZoom = event.ctrlKey || event.metaKey;
    if (!shouldZoom) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? SCREENSHOT_VIEWER_ZOOM_STEP : -SCREENSHOT_VIEWER_ZOOM_STEP;
    setViewerZoom((current) => clampViewerZoom(current + delta));
  }

  async function copyScreenshotImage(): Promise<void> {
    if (!fullScreenshotDataUrl || isCopyingImage) {
      return;
    }

    setIsCopyingImage(true);
    setCopyImageStatus('');

    try {
      const clipboard = navigator.clipboard;
      const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;

      if (!clipboard?.write || !ClipboardItemCtor) {
        throw new Error('Image copy is not supported in this environment.');
      }

      const response = await fetch(fullScreenshotDataUrl);
      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';
      const clipboardItem = new ClipboardItemCtor({ [mimeType]: blob });
      await clipboard.write([clipboardItem]);
      setCopyImageStatus('Image copied.');
    } catch (error) {
      setCopyImageStatus(toErrorMessage(error));
    } finally {
      setIsCopyingImage(false);
    }
  }

  return (
    <>
      <article className="rounded-2xl border border-border/80 bg-background/52 p-3.5 shadow-[0_20px_50px_-36px_hsl(198_93%_42%/0.75)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-foreground">
            Step {result.stepOrder}: {result.stepRawText}
          </h4>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(result.status)}`}>
            {result.status.toUpperCase()}
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <section className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Screenshot preview
            </h5>
            {isLoadingThumbnail ? <p className="text-xs text-muted-foreground">Loading thumbnail...</p> : null}
            {!isLoadingThumbnail && thumbnailError ? <p className="text-xs text-danger">{thumbnailError}</p> : null}
            {!isLoadingThumbnail && !thumbnailError && thumbnailDataUrl ? (
              <button
                type="button"
                className="group relative block w-full overflow-hidden rounded-lg border border-border bg-background"
                onClick={() => setIsScreenshotViewerOpen(true)}
              >
                <img
                  className="max-h-[220px] w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                  src={thumbnailDataUrl}
                  alt={`Step ${result.stepOrder} screenshot thumbnail`}
                  loading="lazy"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-border/90 bg-card/90 px-2 py-1 text-[11px] font-semibold text-foreground">
                  Open full size
                </span>
              </button>
            ) : null}
            {!isLoadingThumbnail && !thumbnailError && !thumbnailDataUrl ? (
              <p className="text-xs text-muted-foreground">No screenshot captured for this step.</p>
            ) : null}
          </section>

          <section className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Error details</h5>
            {result.errorText ? (
              <pre className="max-h-[320px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg border border-danger/45 bg-danger/8 p-2.5 font-mono text-xs text-danger">
                {result.errorText}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">No error recorded.</p>
            )}
          </section>
        </div>
      </article>
      {isScreenshotViewerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Step ${result.stepOrder} screenshot viewer`}
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
              onClick={() => setIsScreenshotViewerOpen(false)}
            >
              <div className="relative max-h-[95vh] max-w-[95vw]" onClick={(event) => event.stopPropagation()}>
                <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                  {copyImageStatus ? (
                    <span className="rounded-md border border-border/80 bg-card/92 px-2 py-1 text-[11px] font-medium text-foreground">
                      {copyImageStatus}
                    </span>
                  ) : null}
                  <div className="inline-flex h-9 items-center gap-1 rounded-full border border-border/80 bg-card/92 px-1.5">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={zoomOut}
                      disabled={!canZoom || viewerZoom <= SCREENSHOT_VIEWER_MIN_ZOOM}
                      aria-label="Zoom out"
                    >
                      -
                    </button>
                    <span
                      className="min-w-[54px] text-center text-[11px] font-semibold text-foreground"
                      title="Use Ctrl/Cmd + wheel to zoom"
                    >
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
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-card/92 px-3 text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void copyScreenshotImage()}
                    disabled={isCopyingImage || isLoadingFullScreenshot || !fullScreenshotDataUrl}
                  >
                    {isCopyingImage ? 'Copying...' : 'Copy image'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card/92 text-foreground transition hover:bg-secondary/85"
                    onClick={() => setIsScreenshotViewerOpen(false)}
                    aria-label="Close screenshot viewer"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex min-h-[280px] min-w-[320px] items-center justify-center">
                  {isLoadingFullScreenshot ? (
                    <p className="rounded-md border border-border/80 bg-card/92 px-3 py-2 text-xs font-medium text-foreground">
                      Loading full screenshot...
                    </p>
                  ) : null}
                  {!isLoadingFullScreenshot && fullScreenshotError ? (
                    <div className="space-y-2">
                      <p className="rounded-md border border-danger/45 bg-danger/12 px-3 py-2 text-xs font-medium text-danger">
                        {fullScreenshotError}
                      </p>
                      {thumbnailDataUrl ? (
                        <img
                          src={thumbnailDataUrl}
                          alt={`Step ${result.stepOrder} screenshot thumbnail fallback`}
                          className="max-h-[95vh] max-w-[95vw] rounded-xl border border-border/80 bg-background object-contain shadow-2xl"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {!isLoadingFullScreenshot && !fullScreenshotError && fullScreenshotDataUrl ? (
                    <div
                      className="max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl border border-border/80 bg-background shadow-2xl"
                      onWheel={handleViewerWheel}
                    >
                      <img
                        src={fullScreenshotDataUrl}
                        alt={`Step ${result.stepOrder} screenshot full size`}
                        className="mx-auto block h-auto max-w-none rounded-xl object-contain select-none"
                        style={{ width: `${zoomPercent}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function clampViewerZoom(value: number): number {
  return Math.min(SCREENSHOT_VIEWER_MAX_ZOOM, Math.max(SCREENSHOT_VIEWER_MIN_ZOOM, Number(value.toFixed(2))));
}
