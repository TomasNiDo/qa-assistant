import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QaAssistantApi } from '@shared/ipc';
import { loadThumbnailWithFallback } from './screenshotLoader';

describe('screenshotLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns thumbnail data when thumbnail endpoint succeeds', async () => {
    const api = {
      runGetScreenshotThumbnailDataUrl: vi.fn(async () => ({ ok: true as const, data: 'data:image/jpeg;base64,THUMB' })),
      runGetScreenshotDataUrl: vi.fn(async () => ({ ok: true as const, data: 'data:image/png;base64,FULL' })),
    };

    const result = await loadThumbnailWithFallback(api, '/tmp/screenshot.png', 'step-1');

    expect(result).toEqual({
      ok: true,
      dataUrl: 'data:image/jpeg;base64,THUMB',
      source: 'thumbnail',
    });
    expect(api.runGetScreenshotDataUrl).not.toHaveBeenCalled();
  });

  it('falls back to full screenshot when thumbnail endpoint rejects with no-handler error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = {
      runGetScreenshotThumbnailDataUrl: vi.fn(async () => {
        throw new Error('No handler registered for run.getScreenshotThumbnailDataUrl');
      }),
      runGetScreenshotDataUrl: vi.fn(async () => ({ ok: true as const, data: 'data:image/png;base64,FULL' })),
    };

    const result = await loadThumbnailWithFallback(api, '/tmp/screenshot.png', 'step-2');

    expect(result).toEqual({
      ok: true,
      dataUrl: 'data:image/png;base64,FULL',
      source: 'full',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('thumbnail load failed for step step-2: No handler registered'),
    );
  });

  it('falls back to full screenshot when thumbnail method is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = {
      runGetScreenshotDataUrl: vi.fn(async () => ({ ok: true as const, data: 'data:image/png;base64,FULL' })),
    } as unknown as Pick<QaAssistantApi, 'runGetScreenshotDataUrl' | 'runGetScreenshotThumbnailDataUrl'>;

    const result = await loadThumbnailWithFallback(api, '/tmp/screenshot.png', 'step-3');

    expect(result).toEqual({
      ok: true,
      dataUrl: 'data:image/png;base64,FULL',
      source: 'full',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[screenshots] thumbnail load failed for step step-3: Thumbnail API is not available in this app session.',
    );
  });

  it('falls back to full screenshot when thumbnail endpoint returns ApiResult error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = {
      runGetScreenshotThumbnailDataUrl: vi.fn(async () => ({
        ok: false as const,
        error: { message: 'Screenshot path is outside artifacts directory.' },
      })),
      runGetScreenshotDataUrl: vi.fn(async () => ({ ok: true as const, data: 'data:image/png;base64,FULL' })),
    };

    const result = await loadThumbnailWithFallback(api, '/tmp/screenshot.png', 'step-4');

    expect(result).toEqual({
      ok: true,
      dataUrl: 'data:image/png;base64,FULL',
      source: 'full',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[screenshots] thumbnail load failed for step step-4: Screenshot path is outside artifacts directory.',
    );
  });

  it('returns a failure when both thumbnail and full screenshot calls fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = {
      runGetScreenshotThumbnailDataUrl: vi.fn(async () => ({
        ok: false as const,
        error: { message: 'No handler registered for run.getScreenshotThumbnailDataUrl' },
      })),
      runGetScreenshotDataUrl: vi.fn(async () => ({
        ok: false as const,
        error: { message: 'No handler registered for run.getScreenshotDataUrl' },
      })),
    };

    const result = await loadThumbnailWithFallback(api, '/tmp/screenshot.png', 'step-5');

    expect(result).toEqual({
      ok: false,
      message: 'Screenshot preview is temporarily unavailable. Reload the app and retry.',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
