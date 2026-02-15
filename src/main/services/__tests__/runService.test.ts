import { describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import type { AppConfig, BrowserInstallState } from '@shared/types';
import { RunService } from '../runService';
import { BrowserService } from '../browserService';

type RunRow = {
  id: string;
  test_case_id: string;
  browser: 'chromium' | 'firefox' | 'webkit';
  status: string;
  started_at: string;
  ended_at: string | null;
};

type TestCaseRow = {
  id: string;
  project_id: string;
};

type StepRow = {
  id: string;
  step_order: number;
  raw_text: string;
};

type StepResultRow = {
  id: string;
  run_id: string;
  step_id: string;
  status: 'pending' | 'passed' | 'failed' | 'cancelled';
  error_text: string | null;
  screenshot_path: string | null;
};

class RunServiceTestDb {
  public runs: RunRow[] = [];
  public testCases: TestCaseRow[] = [];
  public steps: StepRow[] = [];
  public stepResults: StepResultRow[] = [];

  prepare(sql: string): {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  } {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.includes('SELECT id, test_case_id, browser, status, started_at, ended_at') &&
      normalized.includes('FROM runs') &&
      normalized.includes('WHERE id = ?')
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [id] = args as [string];
          return this.runs.find((row) => row.id === id);
        },
        all: () => [],
      };
    }

    if (normalized.includes('FROM runs JOIN test_cases ON test_cases.id = runs.test_case_id')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => {
          const running = this.runs
            .filter((row) => row.status === 'running')
            .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
          if (!running) {
            return undefined;
          }

          const testCase = this.testCases.find((row) => row.id === running.test_case_id);
          if (!testCase) {
            return undefined;
          }

          return {
            run_id: running.id,
            test_case_id: running.test_case_id,
            project_id: testCase.project_id,
          };
        },
        all: () => [],
      };
    }

    if (normalized.includes('UPDATE runs SET status = ?, ended_at = ? WHERE id = ?')) {
      return {
        run: (...args) => {
          const [status, endedAt, runId] = args as [RunRow['status'], string, string];
          const row = this.runs.find((item) => item.id === runId);
          if (!row) {
            return { changes: 0 };
          }

          row.status = status;
          row.ended_at = endedAt;
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (
      normalized.includes("UPDATE step_results SET status = 'cancelled', error_text = COALESCE(error_text, 'Step did not run.')")
    ) {
      return {
        run: (...args) => {
          const [runId] = args as [string];
          let changes = 0;

          for (const row of this.stepResults) {
            if (row.run_id === runId && row.status === 'pending') {
              row.status = 'cancelled';
              row.error_text = row.error_text ?? 'Step did not run.';
              changes += 1;
            }
          }

          return { changes };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM step_results LEFT JOIN steps ON steps.id = step_results.step_id')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [runId] = args as [string];
          return this.stepResults
            .filter((row) => row.run_id === runId)
            .map((row) => {
              const step = this.steps.find((item) => item.id === row.step_id);
              return {
                id: row.id,
                run_id: row.run_id,
                step_id: row.step_id,
                status: row.status,
                error_text: row.error_text,
                screenshot_path: row.screenshot_path,
                step_order: step?.step_order ?? null,
                raw_text: step?.raw_text ?? null,
              };
            })
            .sort((a, b) => {
              const orderA = a.step_order ?? 2147483647;
              const orderB = b.step_order ?? 2147483647;
              if (orderA !== orderB) {
                return orderA - orderB;
              }
              return a.id.localeCompare(b.id);
            });
        },
      };
    }

    throw new Error(`Unsupported SQL in RunServiceTestDb: ${normalized}`);
  }

  close(): void {}
}

function createBrowserServiceStub(): BrowserService {
  const status: BrowserInstallState = {
    browser: 'chromium',
    installed: true,
    installInProgress: false,
    executablePath: null,
    lastError: null,
  };

  return {
    setInstallUpdateEmitter: () => undefined,
    getStatuses: () => [status],
    getStatus: () => status,
    install: async () => undefined,
    ensureInstalled: async () => undefined,
    launch: async () => {
      throw new Error('Not used in these tests.');
    },
  } as unknown as BrowserService;
}

function createConfig(): AppConfig {
  return {
    defaultBrowser: 'chromium',
    stepTimeoutSeconds: 30,
    continueOnFailure: false,
    enableSampleProjectSeed: true,
  };
}

describe('RunService', () => {
  it('returns in-memory active run context when present', () => {
    const db = new RunServiceTestDb() as unknown as Database.Database;
    const service = new RunService(db, '/tmp/artifacts', createBrowserServiceStub(), createConfig);

    (service as unknown as { activeRun: unknown }).activeRun = {
      runId: 'run-memory',
      testCaseId: 'test-memory',
      projectId: 'project-memory',
      abortController: new AbortController(),
    };

    expect(service.activeContext()).toEqual({
      runId: 'run-memory',
      testCaseId: 'test-memory',
      projectId: 'project-memory',
    });
  });

  it('falls back to database running context when no in-memory run exists', () => {
    const rawDb = new RunServiceTestDb();
    rawDb.testCases.push({ id: 'test-a', project_id: 'project-a' });
    rawDb.runs.push({
      id: 'run-a',
      test_case_id: 'test-a',
      browser: 'chromium',
      status: 'running',
      started_at: '2025-01-01T00:00:00.000Z',
      ended_at: null,
    });

    const service = new RunService(
      rawDb as unknown as Database.Database,
      '/tmp/artifacts',
      createBrowserServiceStub(),
      createConfig,
    );

    expect(service.activeContext()).toEqual({
      runId: 'run-a',
      testCaseId: 'test-a',
      projectId: 'project-a',
    });
  });

  it('returns step results even when related step rows are missing', () => {
    const rawDb = new RunServiceTestDb();
    rawDb.stepResults.push({
      id: 'step-result-missing',
      run_id: 'run-1',
      step_id: 'missing-step',
      status: 'failed',
      error_text: 'missing',
      screenshot_path: null,
    });

    const service = new RunService(
      rawDb as unknown as Database.Database,
      '/tmp/artifacts',
      createBrowserServiceStub(),
      createConfig,
    );

    expect(service.stepResults('run-1')).toEqual([
      {
        id: 'step-result-missing',
        runId: 'run-1',
        stepId: 'missing-step',
        stepOrder: 0,
        stepRawText: '[missing step]',
        status: 'failed',
        errorText: 'missing',
        screenshotPath: null,
      },
    ]);
  });

  it('cancels safely when active run row is already missing', () => {
    const rawDb = new RunServiceTestDb();
    const service = new RunService(
      rawDb as unknown as Database.Database,
      '/tmp/artifacts',
      createBrowserServiceStub(),
      createConfig,
    );

    (service as unknown as { activeRun: unknown }).activeRun = {
      runId: 'run-missing',
      testCaseId: 'test-missing',
      projectId: 'project-missing',
      abortController: new AbortController(),
    };

    expect(service.cancel('run-missing')).toBe(true);
    expect(service.activeContext()).toBeNull();
  });
});
