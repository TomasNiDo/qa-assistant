import type Database from 'better-sqlite3';
import type { Run, RunStatus, StartRunInput, Step, StepResult, StepStatus } from '@shared/types';
import { createId } from './id';
import { nowIso } from './time';

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

export class RunService {
  private activeRun: ActiveRun | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly artifactsDir: string,
  ) {}

  start(input: StartRunInput): Run {
    if (this.activeRun) {
      throw new Error('A run is already in progress.');
    }

    const run: Run = {
      id: createId(),
      testCaseId: input.testCaseId,
      browser: input.browser,
      status: 'running',
      startedAt: nowIso(),
      endedAt: null,
    };

    this.db
      .prepare(
        `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
         VALUES (@id, @testCaseId, @browser, @status, @startedAt, @endedAt)`,
      )
      .run(run);

    const abortController = new AbortController();
    this.activeRun = { runId: run.id, abortController };

    // Fire-and-forget worker loop for MVP while Playwright integration lands.
    void this.executeRun(run.id, input.testCaseId, abortController.signal);

    return run;
  }

  cancel(runId: string): boolean {
    if (!this.activeRun || this.activeRun.runId !== runId) {
      return false;
    }

    this.activeRun.abortController.abort();

    this.updateRunStatus(runId, 'cancelled', nowIso());
    this.markPendingStepsCancelled(runId);
    this.activeRun = null;

    return true;
  }

  status(runId: string): Run | null {
    const row = this.db
      .prepare(
        `SELECT id, test_case_id, browser, status, started_at, ended_at
         FROM runs
         WHERE id = ?`,
      )
      .get(runId) as
      | {
          id: string;
          test_case_id: string;
          browser: Run['browser'];
          status: RunStatus;
          started_at: string;
          ended_at: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      testCaseId: row.test_case_id,
      browser: row.browser,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    };
  }

  history(testCaseId: string): Run[] {
    const rows = this.db
      .prepare(
        `SELECT id, test_case_id, browser, status, started_at, ended_at
         FROM runs
         WHERE test_case_id = ?
         ORDER BY started_at DESC`,
      )
      .all(testCaseId) as Array<{
      id: string;
      test_case_id: string;
      browser: Run['browser'];
      status: RunStatus;
      started_at: string;
      ended_at: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      testCaseId: row.test_case_id,
      browser: row.browser,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
    }));
  }

  stepResults(runId: string): StepResult[] {
    const rows = this.db
      .prepare(
        `SELECT id, run_id, step_id, status, error_text, screenshot_path
         FROM step_results
         WHERE run_id = ?`,
      )
      .all(runId) as Array<{
      id: string;
      run_id: string;
      step_id: string;
      status: StepStatus;
      error_text: string | null;
      screenshot_path: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      status: row.status,
      errorText: row.error_text,
      screenshotPath: row.screenshot_path,
    }));
  }

  private async executeRun(runId: string, testCaseId: string, signal: AbortSignal): Promise<void> {
    const steps = this.listSteps(testCaseId);
    let failed = false;

    for (const step of steps) {
      if (signal.aborted) {
        return;
      }

      await wait(350);

      if (signal.aborted) {
        return;
      }

      const shouldFail = /\[fail\]/i.test(step.rawText);
      const status: StepStatus = shouldFail ? 'failed' : 'passed';
      const errorText = shouldFail ? 'Synthetic failure marker [fail] encountered.' : null;

      this.db
        .prepare(
          `INSERT INTO step_results (id, run_id, step_id, status, error_text, screenshot_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          createId(),
          runId,
          step.id,
          status,
          errorText,
          `${this.artifactsDir}/${runId}/${step.id}.png`,
        );

      if (shouldFail) {
        failed = true;
        break;
      }
    }

    if (signal.aborted || this.status(runId)?.status === 'cancelled') {
      return;
    }

    this.updateRunStatus(runId, failed ? 'failed' : 'passed', nowIso());
    this.activeRun = null;
  }

  private listSteps(testCaseId: string): Step[] {
    const rows = this.db
      .prepare(
        `SELECT id, test_case_id, step_order, raw_text, action_json
         FROM steps
         WHERE test_case_id = ?
         ORDER BY step_order ASC`,
      )
      .all(testCaseId) as Array<{
      id: string;
      test_case_id: string;
      step_order: number;
      raw_text: string;
      action_json: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      testCaseId: row.test_case_id,
      stepOrder: row.step_order,
      rawText: row.raw_text,
      actionJson: row.action_json,
    }));
  }

  private updateRunStatus(runId: string, status: RunStatus, endedAt: string): void {
    this.db
      .prepare('UPDATE runs SET status = ?, ended_at = ? WHERE id = ?')
      .run(status, endedAt, runId);
  }

  private markPendingStepsCancelled(runId: string): void {
    this.db
      .prepare(
        `UPDATE step_results
         SET status = 'cancelled'
         WHERE run_id = ? AND status = 'pending'`,
      )
      .run(runId);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
