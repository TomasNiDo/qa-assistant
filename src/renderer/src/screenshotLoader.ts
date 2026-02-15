import type { QaAssistantApi } from '@shared/ipc';

export type ScreenshotSource = 'thumbnail' | 'full';

export type ScreenshotLoadResult =
  | { ok: true; dataUrl: string; source: ScreenshotSource }
  | { ok: false; message: string };

type ScreenshotApi = Pick<QaAssistantApi, 'runGetScreenshotDataUrl' | 'runGetScreenshotThumbnailDataUrl'>;

export async function loadFullScreenshot(
  api: ScreenshotApi,
  screenshotPath: string,
): Promise<ScreenshotLoadResult> {
  try {
    const response = await api.runGetScreenshotDataUrl(screenshotPath);
    if (!response.ok) {
      return { ok: false, message: toUserMessage(response.error.message) };
    }

    return { ok: true, dataUrl: response.data, source: 'full' };
  } catch (error) {
    return { ok: false, message: toUserMessage(toErrorMessage(error)) };
  }
}

export async function loadThumbnailWithFallback(
  api: ScreenshotApi,
  screenshotPath: string,
  stepId: string,
): Promise<ScreenshotLoadResult> {
  const thumbnailMethod = api.runGetScreenshotThumbnailDataUrl;

  if (typeof thumbnailMethod !== 'function') {
    const reason = 'Thumbnail API is not available in this app session.';
    warnThumbnailFailure(stepId, reason);
    return loadFullScreenshot(api, screenshotPath);
  }

  try {
    const response = await thumbnailMethod(screenshotPath);
    if (response.ok) {
      return { ok: true, dataUrl: response.data, source: 'thumbnail' };
    }

    const reason = toErrorMessage(response.error.message);
    warnThumbnailFailure(stepId, reason);
    return loadFullScreenshot(api, screenshotPath);
  } catch (error) {
    const reason = toErrorMessage(error);
    warnThumbnailFailure(stepId, reason);
    return loadFullScreenshot(api, screenshotPath);
  }
}

function warnThumbnailFailure(stepId: string, reason: string): void {
  console.warn(`[screenshots] thumbnail load failed for step ${stepId}: ${reason}`);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error');
}

function toUserMessage(message: string): string {
  const normalized = toErrorMessage(message).trim();

  if (isCompatibilityError(normalized)) {
    return 'Screenshot preview is temporarily unavailable. Reload the app and retry.';
  }

  if (!normalized) {
    return 'Failed to load screenshot preview.';
  }

  return normalized;
}

function isCompatibilityError(message: string): boolean {
  return /is not a function|No handler registered/i.test(message);
}
