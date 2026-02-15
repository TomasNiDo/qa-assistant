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
    return 'border-success/60 bg-success/12 text-success';
  }

  if (status === 'installing') {
    return 'border-primary/60 bg-primary/10 text-primary';
  }

  if (status === 'failed' || status === 'missing') {
    return 'border-danger/60 bg-danger/12 text-danger';
  }

  if (status === 'cancelled') {
    return 'border-border bg-secondary/50 text-muted-foreground';
  }

  return 'border-primary/60 bg-primary/10 text-primary';
}

export function runStatusClassName(status: Run['status']): string {
  if (status === 'passed') {
    return 'border-success/60 bg-success/12 text-success';
  }

  if (status === 'failed') {
    return 'border-danger/60 bg-danger/12 text-danger';
  }

  if (status === 'cancelled') {
    return 'border-border bg-secondary/50 text-muted-foreground';
  }

  return 'border-primary/60 bg-primary/10 text-primary';
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
