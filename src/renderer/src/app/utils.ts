import type { QaAssistantApi } from '@shared/ipc';
import type { GeneratedBugReport, Run, StepResult } from '@shared/types';

export function validateBaseUrl(baseUrl: string): string | null {
  const value = baseUrl.trim();
  if (!value) {
    return 'Base URL is required.';
  }

  try {
    void new URL(value);
    return null;
  } catch {
    return 'Base URL must be a valid URL including protocol (https://...).';
  }
}

export function parseStepLines(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line));
}

export function formatBugReport(report: GeneratedBugReport): string {
  return [
    `Title: ${report.title}`,
    `Environment: ${report.environment}`,
    '',
    'Steps to Reproduce:',
    ...report.stepsToReproduce.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Expected Result: ${report.expectedResult}`,
    `Actual Result: ${report.actualResult}`,
    '',
    'Evidence:',
    ...report.evidence.map((item) => `- ${item}`),
  ].join('\n');
}

export function formatRunDuration(run: Run): string {
  const startedAt = Date.parse(run.startedAt);
  const endedAt = Date.parse(run.endedAt ?? new Date().toISOString());
  const durationMs = Math.max(0, endedAt - startedAt);
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function statusClassName(
  status: StepResult['status'] | 'installed' | 'missing' | 'installing',
): string {
  if (status === 'passed' || status === 'installed') {
    return 'bg-success/18 text-success';
  }

  if (status === 'installing') {
    return 'bg-primary/16 text-primary';
  }

  if (status === 'failed' || status === 'missing') {
    return 'bg-danger/18 text-danger';
  }

  if (status === 'cancelled') {
    return 'bg-secondary/70 text-muted-foreground';
  }

  return 'bg-primary/16 text-primary';
}

export function runStatusClassName(status: Run['status']): string {
  if (status === 'passed') {
    return 'bg-success/18 text-success';
  }

  if (status === 'failed') {
    return 'bg-danger/18 text-danger';
  }

  if (status === 'cancelled') {
    return 'bg-secondary/70 text-muted-foreground';
  }

  return 'bg-primary/16 text-primary';
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[;,.]+$/g, '').trim();
}

export interface FailureDetails {
  expected: string;
  received: string;
  location: string;
}

export function parseFailureDetails(step: StepResult | null): FailureDetails {
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

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function copyImageSourceToClipboard(imageSource: string): Promise<void> {
  const nativeError = await tryCopyImageWithNativeClipboard(imageSource);
  if (!nativeError) {
    return;
  }

  const browserError = await tryCopyImageWithNavigator(imageSource);
  if (!browserError) {
    return;
  }

  throw new Error(
    `Failed to copy image to clipboard. Native clipboard failed: ${nativeError.message}. Browser clipboard failed: ${browserError.message}.`,
  );
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to legacy copy below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

async function toImageBlob(imageSource: string): Promise<Blob> {
  if (imageSource.startsWith('data:')) {
    return dataUrlToBlob(imageSource);
  }

  const response = await fetch(imageSource);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}).`);
  }

  return response.blob();
}

async function tryCopyImageWithNavigator(imageSource: string): Promise<Error | null> {
  try {
    const clipboard = navigator.clipboard;
    const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem })
      .ClipboardItem;

    if (!clipboard?.write || !ClipboardItemCtor) {
      return new Error('Image copy is not supported in this environment.');
    }

    const blob = await toImageBlob(imageSource);
    const mimeType = blob.type || 'image/png';
    const clipboardItem = new ClipboardItemCtor({ [mimeType]: blob });
    await clipboard.write([clipboardItem]);
    return null;
  } catch (error) {
    return toError(error);
  }
}

async function tryCopyImageWithNativeClipboard(imageSource: string): Promise<Error | null> {
  try {
    const qaApi = (window as Window & { qaApi?: Partial<QaAssistantApi> }).qaApi;
    if (!qaApi?.copyImageToClipboard) {
      return new Error('Native clipboard bridge is unavailable.');
    }

    const dataUrl = await toDataUrl(imageSource);
    const result = await qaApi.copyImageToClipboard(dataUrl);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    if (!result.data) {
      throw new Error('Native clipboard copy returned no result.');
    }

    return null;
  } catch (error) {
    return toError(error);
  }
}

async function toDataUrl(imageSource: string): Promise<string> {
  if (imageSource.startsWith('data:')) {
    return imageSource;
  }

  const blob = await toImageBlob(imageSource);
  return blobToDataUrl(blob);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex < 0) {
    throw new Error('Invalid image data URL.');
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const metaParts = metadata.split(';').filter(Boolean);
  const mimeType = metaParts[0] || 'application/octet-stream';
  const isBase64 = metaParts.includes('base64');

  if (isBase64) {
    const binary = atob(payload.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Failed to convert image for clipboard copy.'));
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Clipboard conversion returned invalid image data.'));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown error');
}
