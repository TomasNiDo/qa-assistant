import { mkdirSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import type {
  AppConfig,
  BrowserInstallState,
  BrowserInstallUpdate,
  BrowserName,
  ParsedAction,
  Run,
  RunStatus,
  RunUpdateEvent,
  StartRunInput,
  Step,
  StepResult,
  StepStatus,
} from '@shared/types';
import type { Browser as PlaywrightBrowser, BrowserContext, Page } from 'playwright';
import { createId } from './id';
import { BrowserService } from './browserService';
import { parseStep } from './parserService';
import { nowIso } from './time';

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

interface ExecutionStep extends Step {
  action: ParsedAction;
}

interface RunContext {
  testTitle: string;
  projectName: string;
  baseUrl: string;
}

export class RunService {
  private activeRun: ActiveRun | null = null;
  private emitRunUpdate: (event: RunUpdateEvent) => void = () => undefined;

  constructor(
    private readonly db: Database.Database,
    private readonly artifactsDir: string,
    private readonly browserService: BrowserService,
    private readonly getConfig: () => AppConfig,
  ) {}

  setRunUpdateEmitter(emitter: (event: RunUpdateEvent) => void): void {
    this.emitRunUpdate = emitter;
  }

  setBrowserInstallUpdateEmitter(emitter: (event: BrowserInstallUpdate) => void): void {
    this.browserService.setInstallUpdateEmitter(emitter);
  }

  browserStatuses(): BrowserInstallState[] {
    return this.browserService.getStatuses();
  }

  async installBrowser(browser: BrowserName): Promise<BrowserInstallState> {
    await this.browserService.install(browser);
    return this.browserService.getStatus(browser);
  }

  start(input: StartRunInput): Run {
    if (this.activeRun) {
      throw new Error('A run is already in progress.');
    }

    const context = this.getRunContext(input.testCaseId);
    const steps = this.listExecutionSteps(input.testCaseId);
    if (steps.length === 0) {
      throw new Error('Test case has no steps. Add at least one step before running.');
    }

    const run: Run = {
      id: createId(),
      testCaseId: input.testCaseId,
      browser: input.browser,
      status: 'running',
      startedAt: nowIso(),
      endedAt: null,
    };

    const transaction = this.db.transaction((createdRun: Run, runSteps: ExecutionStep[]) => {
      this.db
        .prepare(
          `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
           VALUES (@id, @testCaseId, @browser, @status, @startedAt, @endedAt)`,
        )
        .run(createdRun);

      const insertStepResult = this.db.prepare(
        `INSERT INTO step_results (id, run_id, step_id, status, error_text, screenshot_path)
         VALUES (?, ?, ?, 'pending', NULL, NULL)`,
      );

      for (const step of runSteps) {
        insertStepResult.run(createId(), createdRun.id, step.id);
      }
    });

    transaction(run, steps);

    const abortController = new AbortController();
    this.activeRun = { runId: run.id, abortController };

    this.emitUpdate({
      runId: run.id,
      type: 'run-started',
      runStatus: 'running',
      message: `Running ${steps.length} step(s) for ${context.testTitle}.`,
    });

    void this.executeRun(run, context, steps, abortController.signal);

    return run;
  }

  cancel(runId: string): boolean {
    if (!this.activeRun || this.activeRun.runId !== runId) {
      return false;
    }

    this.activeRun.abortController.abort();
    this.updateRunStatus(runId, 'cancelled', nowIso());
    this.markPendingStepsCancelled(runId);

    this.emitUpdate({
      runId,
      type: 'run-finished',
      runStatus: 'cancelled',
      message: 'Run cancelled immediately.',
    });

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
        `SELECT step_results.id,
                step_results.run_id,
                step_results.step_id,
                step_results.status,
                step_results.error_text,
                step_results.screenshot_path,
                steps.step_order,
                steps.raw_text
         FROM step_results
         JOIN steps ON steps.id = step_results.step_id
         WHERE step_results.run_id = ?
         ORDER BY steps.step_order ASC`,
      )
      .all(runId) as Array<{
      id: string;
      run_id: string;
      step_id: string;
      status: StepStatus;
      error_text: string | null;
      screenshot_path: string | null;
      step_order: number;
      raw_text: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      stepOrder: row.step_order,
      stepRawText: row.raw_text,
      status: row.status,
      errorText: row.error_text,
      screenshotPath: row.screenshot_path,
    }));
  }

  getScreenshotDataUrl(screenshotPath: string): string {
    const normalizedInput = normalize(screenshotPath).trim();
    if (!normalizedInput) {
      throw new Error('Screenshot path is required.');
    }

    const absoluteArtifactsDir = resolve(this.artifactsDir);
    const absoluteScreenshotPath = resolve(normalizedInput);
    if (!absoluteScreenshotPath.startsWith(`${absoluteArtifactsDir}${process.platform === 'win32' ? '\\' : '/'}`) &&
        absoluteScreenshotPath !== absoluteArtifactsDir) {
      throw new Error('Screenshot path is outside artifacts directory.');
    }

    const bytes = readFileSync(absoluteScreenshotPath);
    const mimeType = toImageMimeType(absoluteScreenshotPath);
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  }

  private async executeRun(
    run: Run,
    context: RunContext,
    steps: ExecutionStep[],
    signal: AbortSignal,
  ): Promise<void> {
    const config = this.getConfig();
    const timeoutMs = config.stepTimeoutSeconds * 1000;

    let browser: PlaywrightBrowser | null = null;
    let browserContext: BrowserContext | null = null;
    let page: Page | null = null;

    let failed = false;
    let terminalMessage: string | undefined;

    const closeResources = () => {
      void page?.close().catch(() => undefined);
      void browserContext?.close().catch(() => undefined);
      void browser?.close().catch(() => undefined);
    };

    signal.addEventListener('abort', closeResources, { once: true });

    try {
      await this.browserService.ensureInstalled(run.browser);
      if (signal.aborted || this.isRunCancelled(run.id)) {
        return;
      }

      browser = await this.browserService.launch(run.browser);
      browserContext = await browser.newContext();
      page = await browserContext.newPage();
      await page.goto(context.baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

      for (const step of steps) {
        if (signal.aborted || this.isRunCancelled(run.id)) {
          return;
        }

        this.emitUpdate({
          runId: run.id,
          type: 'step-started',
          stepId: step.id,
          stepOrder: step.stepOrder,
          stepStatus: 'pending',
        });

        try {
          await this.executeStep(page, step.action, timeoutMs, context.baseUrl);

          const screenshotPath = await this.captureStepScreenshot(page, run.id, step);
          const stepResult = this.updateStepResult(run.id, step.id, 'passed', null, screenshotPath);

          this.emitUpdate({
            runId: run.id,
            type: 'step-finished',
            stepId: step.id,
            stepOrder: step.stepOrder,
            stepStatus: 'passed',
            stepResult,
          });
        } catch (error) {
          if (signal.aborted || this.isRunCancelled(run.id) || isAbortLikeError(error)) {
            return;
          }

          failed = true;
          const errorText = mapPlaywrightError(error, run.browser);
          terminalMessage = errorText;
          const screenshotPath = await this.captureStepScreenshotSafe(page, run.id, step);

          const stepResult = this.updateStepResult(
            run.id,
            step.id,
            'failed',
            errorText,
            screenshotPath,
          );

          this.emitUpdate({
            runId: run.id,
            type: 'step-finished',
            stepId: step.id,
            stepOrder: step.stepOrder,
            stepStatus: 'failed',
            stepResult,
            message: errorText,
          });

          if (!config.continueOnFailure) {
            this.markPendingStepsCancelled(run.id);
            break;
          }
        }
      }
    } catch (error) {
      if (signal.aborted || this.isRunCancelled(run.id)) {
        return;
      }

      failed = true;
      terminalMessage = mapPlaywrightError(error, run.browser);
      this.failFirstPendingStep(run.id, terminalMessage);
      this.markPendingStepsCancelled(run.id);
    } finally {
      signal.removeEventListener('abort', closeResources);

      await page?.close().catch(() => undefined);
      await browserContext?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);

      if (signal.aborted || this.isRunCancelled(run.id)) {
        this.clearActiveRun(run.id);
      } else {
        const finalStatus: RunStatus = failed ? 'failed' : 'passed';
        this.updateRunStatus(run.id, finalStatus, nowIso());

        this.emitUpdate({
          runId: run.id,
          type: 'run-finished',
          runStatus: finalStatus,
          message:
            terminalMessage ??
            (failed
              ? `Run failed for ${context.projectName}.`
              : `Run passed for ${context.projectName}.`),
        });

        this.clearActiveRun(run.id);
      }
    }
  }

  private getRunContext(testCaseId: string): RunContext {
    const row = this.db
      .prepare(
        `SELECT test_cases.title,
                projects.name AS project_name,
                projects.base_url
         FROM test_cases
         JOIN projects ON projects.id = test_cases.project_id
         WHERE test_cases.id = ?`,
      )
      .get(testCaseId) as
      | {
          title: string;
          project_name: string;
          base_url: string;
        }
      | undefined;

    if (!row) {
      throw new Error('Test case not found.');
    }

    return {
      testTitle: row.title,
      projectName: row.project_name,
      baseUrl: row.base_url,
    };
  }

  private listExecutionSteps(testCaseId: string): ExecutionStep[] {
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
      action: parseActionJson(row.action_json, row.raw_text, row.step_order),
    }));
  }

  private async executeStep(
    page: Page,
    action: ParsedAction,
    timeoutMs: number,
    baseUrl: string,
  ): Promise<void> {
    if (action.type === 'enter') {
      await this.performEnter(page, action.target, action.value, timeoutMs);
      return;
    }

    if (action.type === 'click') {
      const clickDelayMs = action.delaySeconds
        ? Math.max(0, Math.min(600_000, Math.round(action.delaySeconds * 1000)))
        : 0;
      if (clickDelayMs > 0) {
        await sleep(clickDelayMs);
      }
      await this.performClick(page, action.target, timeoutMs);
      return;
    }

    if (action.type === 'navigate') {
      await this.performNavigate(page, action.target, baseUrl, timeoutMs);
      return;
    }

    const expectTimeoutMs = action.timeoutSeconds
      ? Math.max(1000, Math.min(600_000, Math.round(action.timeoutSeconds * 1000)))
      : timeoutMs;
    await this.performExpect(page, action.assertion, expectTimeoutMs);
  }

  private async performEnter(
    page: Page,
    fieldName: string,
    value: string,
    timeoutMs: number,
  ): Promise<void> {
    const textMatcher = new RegExp(escapeRegExp(fieldName), 'i');
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<void>> = [
      () => page.getByLabel(textMatcher).first().fill(value, { timeout: attemptTimeout }),
      () => page.getByRole('textbox', { name: textMatcher }).first().fill(value, { timeout: attemptTimeout }),
      () => page.getByPlaceholder(textMatcher).first().fill(value, { timeout: attemptTimeout }),
      () => page.getByText(textMatcher).first().click({ timeout: attemptTimeout }),
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        if (attempt === attempts[3]) {
          await page.keyboard.type(value, { delay: 15 });
        }
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to locate input field "${fieldName}".`);
  }

  private async performClick(page: Page, target: string, timeoutMs: number): Promise<void> {
    const textMatcher = new RegExp(escapeRegExp(target), 'i');
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<void>> = [
      () => page.getByRole('button', { name: textMatcher }).first().click({ timeout: attemptTimeout }),
      () => page.getByRole('link', { name: textMatcher }).first().click({ timeout: attemptTimeout }),
      () => page.getByRole('menuitem', { name: textMatcher }).first().click({ timeout: attemptTimeout }),
      () => page.getByText(textMatcher).first().click({ timeout: attemptTimeout }),
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to locate clickable target "${target}".`);
  }

  private async performExpect(page: Page, assertion: string, timeoutMs: number): Promise<void> {
    const textMatcher = new RegExp(escapeRegExp(assertion), 'i');
    await page.getByText(textMatcher).first().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  private async performNavigate(
    page: Page,
    target: string,
    baseUrl: string,
    timeoutMs: number,
  ): Promise<void> {
    const destination = resolveNavigationTarget(target, page.url(), baseUrl);
    await page.goto(destination, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  }

  private async captureStepScreenshot(page: Page, runId: string, step: ExecutionStep): Promise<string> {
    const runDir = join(this.artifactsDir, runId);
    mkdirSync(runDir, { recursive: true });

    const screenshotPath = join(runDir, `${String(step.stepOrder).padStart(3, '0')}-${step.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  private async captureStepScreenshotSafe(
    page: Page,
    runId: string,
    step: ExecutionStep,
  ): Promise<string | null> {
    try {
      return await this.captureStepScreenshot(page, runId, step);
    } catch {
      return null;
    }
  }

  private updateRunStatus(runId: string, status: RunStatus, endedAt: string): void {
    this.db
      .prepare('UPDATE runs SET status = ?, ended_at = ? WHERE id = ?')
      .run(status, endedAt, runId);
  }

  private updateStepResult(
    runId: string,
    stepId: string,
    status: StepStatus,
    errorText: string | null,
    screenshotPath: string | null,
  ): StepResult {
    this.db
      .prepare(
        `UPDATE step_results
         SET status = ?, error_text = ?, screenshot_path = ?
         WHERE run_id = ? AND step_id = ?`,
      )
      .run(status, errorText, screenshotPath, runId, stepId);

    const row = this.db
      .prepare(
        `SELECT step_results.id,
                step_results.run_id,
                step_results.step_id,
                step_results.status,
                step_results.error_text,
                step_results.screenshot_path,
                steps.step_order,
                steps.raw_text
         FROM step_results
         JOIN steps ON steps.id = step_results.step_id
         WHERE step_results.run_id = ? AND step_results.step_id = ?`,
      )
      .get(runId, stepId) as {
      id: string;
      run_id: string;
      step_id: string;
      status: StepStatus;
      error_text: string | null;
      screenshot_path: string | null;
      step_order: number;
      raw_text: string;
    };

    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      stepOrder: row.step_order,
      stepRawText: row.raw_text,
      status: row.status,
      errorText: row.error_text,
      screenshotPath: row.screenshot_path,
    };
  }

  private failFirstPendingStep(runId: string, errorText: string): void {
    const row = this.db
      .prepare(
        `SELECT step_results.step_id
         FROM step_results
         JOIN steps ON steps.id = step_results.step_id
         WHERE step_results.run_id = ? AND step_results.status = 'pending'
         ORDER BY steps.step_order ASC
         LIMIT 1`,
      )
      .get(runId) as { step_id: string } | undefined;

    if (!row) {
      return;
    }

    const stepResult = this.updateStepResult(runId, row.step_id, 'failed', errorText, null);
    this.emitUpdate({
      runId,
      type: 'step-finished',
      stepId: row.step_id,
      stepOrder: stepResult.stepOrder,
      stepStatus: 'failed',
      stepResult,
      message: errorText,
    });
  }

  private markPendingStepsCancelled(runId: string): void {
    this.db
      .prepare(
        `UPDATE step_results
         SET status = 'cancelled', error_text = COALESCE(error_text, 'Step did not run.')
         WHERE run_id = ? AND status = 'pending'`,
      )
      .run(runId);
  }

  private clearActiveRun(runId: string): void {
    if (this.activeRun?.runId === runId) {
      this.activeRun = null;
    }
  }

  private isRunCancelled(runId: string): boolean {
    return this.status(runId)?.status === 'cancelled';
  }

  private emitUpdate(event: Omit<RunUpdateEvent, 'timestamp'>): void {
    this.emitRunUpdate({ ...event, timestamp: nowIso() });
  }
}

function parseActionJson(actionJson: string, rawText: string, stepOrder: number): ParsedAction {
  try {
    const parsed = JSON.parse(actionJson) as ParsedAction;

    if (parsed.type === 'enter' && typeof parsed.target === 'string' && typeof parsed.value === 'string') {
      return parsed;
    }

    if (parsed.type === 'click' && typeof parsed.target === 'string') {
      let target = parsed.target;
      let delaySeconds = parsed.delaySeconds;
      const reparsed = parseStep(rawText);

      if (reparsed.ok && reparsed.action.type === 'click') {
        target = reparsed.action.target;
        if (delaySeconds === undefined && reparsed.action.delaySeconds !== undefined) {
          delaySeconds = reparsed.action.delaySeconds;
        }
      }

      if (delaySeconds !== undefined && (!Number.isFinite(delaySeconds) || delaySeconds <= 0)) {
        throw new Error('Invalid click delay.');
      }

      return delaySeconds !== undefined
        ? { type: 'click', target, delaySeconds }
        : { type: 'click', target };
    }

    if (parsed.type === 'navigate' && typeof parsed.target === 'string') {
      const reparsed = parseStep(rawText);
      const target =
        reparsed.ok && reparsed.action.type === 'navigate'
          ? reparsed.action.target
          : parsed.target;

      return { type: 'navigate', target };
    }

    if (parsed.type === 'expect' && typeof parsed.assertion === 'string') {
      let assertion = parsed.assertion;
      let timeoutSeconds = parsed.timeoutSeconds;
      const reparsed = parseStep(rawText);

      if (reparsed.ok && reparsed.action.type === 'expect') {
        assertion = reparsed.action.assertion;
        if (timeoutSeconds === undefined && reparsed.action.timeoutSeconds !== undefined) {
          timeoutSeconds = reparsed.action.timeoutSeconds;
        }
      }

      if (timeoutSeconds !== undefined && (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)) {
        throw new Error('Invalid expect timeout.');
      }

      return timeoutSeconds !== undefined
        ? { type: 'expect', assertion, timeoutSeconds }
        : { type: 'expect', assertion };
    }
  } catch {
    // Validated below.
  }

  throw new Error(`Step ${stepOrder} has invalid parsed action data.`);
}

function mapPlaywrightError(error: unknown, browser: BrowserName): string {
  const raw = toMessage(error);

  if (isMissingBrowserMessage(raw)) {
    return `The ${browser} browser runtime is not installed. Click Install for ${browser} and retry.`;
  }

  if (/timeout/i.test(raw)) {
    return 'Step timed out before the page reached the expected state. Add `within 30s` to the Expect step or increase step timeout.';
  }

  if (/navigation|net::|ERR_|NS_ERROR/i.test(raw)) {
    return 'Failed to open the project base URL. Check the URL and network access.';
  }

  if (/strict mode violation/i.test(raw)) {
    return 'Multiple matching elements were found. Narrow the step target text.';
  }

  return `Automation failed: ${raw}`;
}

function isMissingBrowserMessage(message: string): boolean {
  return /executable doesn't exist|please run the following command|browser binaries/i.test(message);
}

function isAbortLikeError(error: unknown): boolean {
  const message = toMessage(error);
  return /Target page, context or browser has been closed|aborted|has been closed/i.test(message);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveNavigationTarget(target: string, currentUrl: string, baseUrl: string): string {
  const value = target.trim();
  if (!value) {
    throw new Error('Navigation target cannot be empty.');
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return new URL(value, baseUrl).toString();
  }

  const fallbackBase = /^https?:\/\//i.test(currentUrl) ? currentUrl : baseUrl;
  return new URL(value, fallbackBase).toString();
}

function toImageMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}
