import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import type {
  ActiveRunContext,
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
  testCaseId: string;
  projectId: string;
  abortController: AbortController;
}

interface ExecutionStep extends Step {
  action: ParsedAction;
}

interface RunContext {
  testTitle: string;
  projectName: string;
  projectId: string;
  baseUrl: string;
}

const SCREENSHOT_THUMBNAIL_SUFFIX = '.thumb.jpg';

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
    this.activeRun = {
      runId: run.id,
      testCaseId: run.testCaseId,
      projectId: context.projectId,
      abortController,
    };

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

  activeContext(): ActiveRunContext | null {
    if (this.activeRun) {
      return {
        runId: this.activeRun.runId,
        testCaseId: this.activeRun.testCaseId,
        projectId: this.activeRun.projectId,
      };
    }

    const row = this.db
      .prepare(
        `SELECT runs.id AS run_id,
                runs.test_case_id,
                test_cases.project_id
         FROM runs
         JOIN test_cases ON test_cases.id = runs.test_case_id
         WHERE runs.status = 'running'
         ORDER BY runs.started_at DESC
         LIMIT 1`,
      )
      .get() as
      | {
          run_id: string;
          test_case_id: string;
          project_id: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      runId: row.run_id,
      testCaseId: row.test_case_id,
      projectId: row.project_id,
    };
  }

  history(testCaseId: string): Run[] {
    const rows = this.db
      .prepare(
         `SELECT id, test_case_id, browser, status, started_at, ended_at
         FROM runs
         WHERE test_case_id = ?
         ORDER BY started_at ASC`,
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
         LEFT JOIN steps ON steps.id = step_results.step_id
         WHERE step_results.run_id = ?
         ORDER BY COALESCE(steps.step_order, 2147483647) ASC, step_results.id ASC`,
      )
      .all(runId) as Array<{
      id: string;
      run_id: string;
      step_id: string;
      status: StepStatus;
      error_text: string | null;
      screenshot_path: string | null;
      step_order: number | null;
      raw_text: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      stepOrder: row.step_order ?? 0,
      stepRawText: row.raw_text ?? '[missing step]',
      status: row.status,
      errorText: row.error_text,
      screenshotPath: row.screenshot_path,
    }));
  }

  getScreenshotDataUrl(screenshotPath: string): string {
    const absoluteScreenshotPath = this.resolveScreenshotPathInArtifacts(screenshotPath);
    return this.toDataUrl(absoluteScreenshotPath);
  }

  getScreenshotThumbnailDataUrl(screenshotPath: string): string {
    const absoluteScreenshotPath = this.resolveScreenshotPathInArtifacts(screenshotPath);
    const thumbnailPath = this.toScreenshotThumbnailPath(absoluteScreenshotPath);

    if (existsSync(thumbnailPath)) {
      return this.toDataUrl(thumbnailPath);
    }

    return this.toDataUrl(absoluteScreenshotPath);
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
      if (this.shouldStopRun(run.id, signal)) {
        return;
      }

      browser = await this.browserService.launch(run.browser);
      browserContext = await browser.newContext();
      page = await browserContext.newPage();
      await page.goto(context.baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

      for (const step of steps) {
        if (this.shouldStopRun(run.id, signal)) {
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
          if (!stepResult) {
            return;
          }

          this.emitUpdate({
            runId: run.id,
            type: 'step-finished',
            stepId: step.id,
            stepOrder: step.stepOrder,
            stepStatus: 'passed',
            stepResult,
          });
        } catch (error) {
          if (this.shouldStopRun(run.id, signal) || isAbortLikeError(error)) {
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
          if (!stepResult) {
            return;
          }

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
      if (this.shouldStopRun(run.id, signal)) {
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

      if (this.shouldStopRun(run.id, signal)) {
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
                projects.id AS project_id,
                projects.base_url
         FROM test_cases
         JOIN projects ON projects.id = test_cases.project_id
         WHERE test_cases.id = ?`,
      )
      .get(testCaseId) as
      | {
          title: string;
          project_name: string;
          project_id: string;
          base_url: string;
        }
      | undefined;

    if (!row) {
      throw new Error('Test case not found.');
    }

    return {
      testTitle: row.title,
      projectName: row.project_name,
      projectId: row.project_id,
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

    if (action.type === 'expect') {
      const expectTimeoutMs = action.timeoutSeconds
        ? Math.max(1000, Math.min(600_000, Math.round(action.timeoutSeconds * 1000)))
        : timeoutMs;
      await this.performExpect(page, action.assertion, expectTimeoutMs);
      return;
    }

    if (action.type === 'select') {
      await this.performSelect(page, action.target, action.value, timeoutMs);
      return;
    }

    if (action.type === 'setChecked') {
      await this.performSetChecked(page, action.target, action.checked, timeoutMs);
      return;
    }

    if (action.type === 'hover') {
      await this.performHover(page, action.target, timeoutMs);
      return;
    }

    if (action.type === 'press') {
      await this.performPress(page, action.key, action.target, timeoutMs);
      return;
    }

    if (action.type === 'upload') {
      await this.performUpload(page, action.target, action.filePaths, timeoutMs);
      return;
    }

    if (action.type === 'dialog') {
      await this.performDialog(page, action.action, action.promptText, timeoutMs);
      return;
    }

    if (action.type === 'waitForRequest') {
      const requestTimeoutMs = action.timeoutSeconds
        ? Math.max(1000, Math.min(600_000, Math.round(action.timeoutSeconds * 1000)))
        : timeoutMs;
      await this.performWaitForRequest(page, action, requestTimeoutMs);
      return;
    }

    const downloadTimeoutMs = action.timeoutSeconds
      ? Math.max(1000, Math.min(600_000, Math.round(action.timeoutSeconds * 1000)))
      : timeoutMs;
    await this.performDownload(page, action.triggerClickTarget, downloadTimeoutMs);
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
    const selectorAttempts = buildElementSelectorCandidates(target).map(
      (selector) => () => page.locator(selector).first().click({ timeout: attemptTimeout }),
    );

    const attempts: Array<() => Promise<void>> = [
      ...selectorAttempts,
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

  private async performSelect(
    page: Page,
    target: string,
    value: string,
    timeoutMs: number,
  ): Promise<void> {
    const targetMatcher = new RegExp(escapeRegExp(target), 'i');
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<unknown>> = [
      () =>
        page
          .getByLabel(targetMatcher)
          .first()
          .selectOption({ label: value }, { timeout: attemptTimeout }),
      () =>
        page
          .getByRole('combobox', { name: targetMatcher })
          .first()
          .selectOption({ label: value }, { timeout: attemptTimeout }),
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to select "${value}" from "${target}" dropdown.`);
  }

  private async performSetChecked(
    page: Page,
    target: string,
    checked: boolean,
    timeoutMs: number,
  ): Promise<void> {
    const targetMatcher = new RegExp(escapeRegExp(target), 'i');
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<void>> = [
      async () => {
        const locator = page.getByLabel(targetMatcher).first();
        if (checked) {
          await locator.check({ timeout: attemptTimeout });
        } else {
          await locator.uncheck({ timeout: attemptTimeout });
        }
      },
      async () => {
        const locator = page.getByRole('checkbox', { name: targetMatcher }).first();
        if (checked) {
          await locator.check({ timeout: attemptTimeout });
        } else {
          await locator.uncheck({ timeout: attemptTimeout });
        }
      },
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to locate checkbox "${target}".`);
  }

  private async performHover(page: Page, target: string, timeoutMs: number): Promise<void> {
    const textMatcher = new RegExp(escapeRegExp(target), 'i');
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<void>> = [
      () => page.getByRole('button', { name: textMatcher }).first().hover({ timeout: attemptTimeout }),
      () => page.getByRole('link', { name: textMatcher }).first().hover({ timeout: attemptTimeout }),
      () => page.getByText(textMatcher).first().hover({ timeout: attemptTimeout }),
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to locate hover target "${target}".`);
  }

  private async performPress(
    page: Page,
    key: string,
    target: string | undefined,
    timeoutMs: number,
  ): Promise<void> {
    if (target) {
      const targetMatcher = new RegExp(escapeRegExp(target), 'i');
      const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));
      const focusAttempts: Array<() => Promise<void>> = [
        () => page.getByLabel(targetMatcher).first().click({ timeout: attemptTimeout }),
        () => page.getByRole('textbox', { name: targetMatcher }).first().click({ timeout: attemptTimeout }),
        () => page.getByPlaceholder(targetMatcher).first().click({ timeout: attemptTimeout }),
        () => page.getByText(targetMatcher).first().click({ timeout: attemptTimeout }),
      ];

      let focused = false;
      for (const attempt of focusAttempts) {
        try {
          await attempt();
          focused = true;
          break;
        } catch {
          // Continue through selector fallbacks.
        }
      }

      if (!focused) {
        throw new Error(`Unable to focus target "${target}" before pressing "${key}".`);
      }
    }

    await page.keyboard.press(key);
  }

  private async performUpload(
    page: Page,
    target: string,
    filePaths: string[],
    timeoutMs: number,
  ): Promise<void> {
    const targetMatcher = new RegExp(escapeRegExp(target), 'i');
    const resolvedPaths = filePaths.map((filePath) => resolve(filePath));
    const attemptTimeout = Math.max(1000, Math.floor(timeoutMs / 3));

    const attempts: Array<() => Promise<void>> = [
      () => page.getByLabel(targetMatcher).first().setInputFiles(resolvedPaths, { timeout: attemptTimeout }),
      () =>
        page
          .getByRole('button', { name: targetMatcher })
          .first()
          .setInputFiles(resolvedPaths, { timeout: attemptTimeout }),
      () =>
        page
          .locator('input[type="file"]')
          .first()
          .setInputFiles(resolvedPaths, { timeout: attemptTimeout }),
    ];

    for (const attempt of attempts) {
      try {
        await attempt();
        return;
      } catch {
        // Continue through selector fallbacks.
      }
    }

    throw new Error(`Unable to locate file input "${target}".`);
  }

  private async performDialog(
    page: Page,
    action: 'accept' | 'dismiss',
    promptText: string | undefined,
    timeoutMs: number,
  ): Promise<void> {
    const dialog = await page.waitForEvent('dialog', { timeout: timeoutMs });
    if (action === 'accept') {
      await dialog.accept(promptText);
      return;
    }

    await dialog.dismiss();
  }

  private async performWaitForRequest(
    page: Page,
    action: Extract<ParsedAction, { type: 'waitForRequest' }>,
    timeoutMs: number,
  ): Promise<void> {
    const predicate = (response: {
      url: () => string;
      status: () => number;
      request: () => { method: () => string };
    }): boolean => {
      const urlMatches = matchesUrlPattern(response.url(), action.urlPattern);
      const methodMatches = action.method
        ? response.request().method().toUpperCase() === action.method.toUpperCase()
        : true;
      const statusMatches = action.status ? response.status() === action.status : true;
      return urlMatches && methodMatches && statusMatches;
    };

    if (action.triggerClickTarget) {
      await Promise.all([
        page.waitForResponse(predicate, { timeout: timeoutMs }),
        this.performClick(page, action.triggerClickTarget, timeoutMs),
      ]);
      return;
    }

    await page.waitForResponse(predicate, { timeout: timeoutMs });
  }

  private async performDownload(
    page: Page,
    triggerClickTarget: string,
    timeoutMs: number,
  ): Promise<void> {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: timeoutMs }),
      this.performClick(page, triggerClickTarget, timeoutMs),
    ]);

    const failure = await download.failure();
    if (failure) {
      throw new Error(`Download failed: ${failure}`);
    }
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
    await this.captureStepThumbnailScreenshot(page, screenshotPath);
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

  private async captureStepThumbnailScreenshot(page: Page, screenshotPath: string): Promise<void> {
    try {
      await page.screenshot({
        path: this.toScreenshotThumbnailPath(screenshotPath),
        fullPage: false,
        type: 'jpeg',
        quality: 60,
        scale: 'css',
      });
    } catch {
      // Preserve run progress even if thumbnail capture fails.
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
  ): StepResult | null {
    const updateResult = this.db
      .prepare(
        `UPDATE step_results
         SET status = ?, error_text = ?, screenshot_path = ?
         WHERE run_id = ? AND step_id = ?`,
      )
      .run(status, errorText, screenshotPath, runId, stepId);
    if (updateResult.changes === 0) {
      return null;
    }

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
         LEFT JOIN steps ON steps.id = step_results.step_id
         WHERE step_results.run_id = ? AND step_results.step_id = ?`,
      )
      .get(runId, stepId) as {
      id: string;
      run_id: string;
      step_id: string;
      status: StepStatus;
      error_text: string | null;
      screenshot_path: string | null;
      step_order: number | null;
      raw_text: string | null;
    } | undefined;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      stepOrder: row.step_order ?? 0,
      stepRawText: row.raw_text ?? '[missing step]',
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
    if (!stepResult) {
      return;
    }
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

  private shouldStopRun(runId: string, signal: AbortSignal): boolean {
    if (signal.aborted) {
      return true;
    }

    const run = this.status(runId);
    return !run || run.status === 'cancelled';
  }

  private emitUpdate(event: Omit<RunUpdateEvent, 'timestamp'>): void {
    this.emitRunUpdate({ ...event, timestamp: nowIso() });
  }

  private resolveScreenshotPathInArtifacts(screenshotPath: string): string {
    const normalizedInput = normalize(screenshotPath).trim();
    if (!normalizedInput) {
      throw new Error('Screenshot path is required.');
    }

    const absoluteArtifactsDir = resolve(this.artifactsDir);
    const absoluteScreenshotPath = resolve(normalizedInput);
    const relativePath = relative(absoluteArtifactsDir, absoluteScreenshotPath);
    const isOutsideArtifactsDir =
      relativePath.length === 0 ||
      relativePath.startsWith('..') ||
      isAbsolute(relativePath);

    if (isOutsideArtifactsDir) {
      throw new Error('Screenshot path is outside artifacts directory.');
    }

    return absoluteScreenshotPath;
  }

  private toScreenshotThumbnailPath(screenshotPath: string): string {
    if (screenshotPath.endsWith(SCREENSHOT_THUMBNAIL_SUFFIX)) {
      return screenshotPath;
    }

    const extension = extname(screenshotPath);
    const basePath = extension ? screenshotPath.slice(0, -extension.length) : screenshotPath;
    return `${basePath}${SCREENSHOT_THUMBNAIL_SUFFIX}`;
  }

  private toDataUrl(filePath: string): string {
    const bytes = readFileSync(filePath);
    const mimeType = toImageMimeType(filePath);
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  }
}

function parseActionJson(actionJson: string, rawText: string, stepOrder: number): ParsedAction {
  try {
    const parsed = JSON.parse(actionJson) as ParsedAction;
    const reparsed = parseStep(rawText);

    if (parsed.type === 'enter' && typeof parsed.target === 'string' && typeof parsed.value === 'string') {
      return parsed;
    }

    if (parsed.type === 'click' && typeof parsed.target === 'string') {
      let target = parsed.target;
      let delaySeconds = parsed.delaySeconds;

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
      const target =
        reparsed.ok && reparsed.action.type === 'navigate'
          ? reparsed.action.target
          : parsed.target;

      return { type: 'navigate', target };
    }

    if (parsed.type === 'expect' && typeof parsed.assertion === 'string') {
      let assertion = parsed.assertion;
      let timeoutSeconds = parsed.timeoutSeconds;

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

    if (parsed.type === 'select' && typeof parsed.target === 'string' && typeof parsed.value === 'string') {
      if (reparsed.ok && reparsed.action.type === 'select') {
        return reparsed.action;
      }
      return parsed;
    }

    if (
      parsed.type === 'setChecked' &&
      typeof parsed.target === 'string' &&
      typeof parsed.checked === 'boolean'
    ) {
      if (reparsed.ok && reparsed.action.type === 'setChecked') {
        return reparsed.action;
      }
      return parsed;
    }

    if (parsed.type === 'hover' && typeof parsed.target === 'string') {
      if (reparsed.ok && reparsed.action.type === 'hover') {
        return reparsed.action;
      }
      return parsed;
    }

    if (parsed.type === 'press' && typeof parsed.key === 'string') {
      if (parsed.target !== undefined && typeof parsed.target !== 'string') {
        throw new Error('Invalid press target.');
      }
      if (reparsed.ok && reparsed.action.type === 'press') {
        return reparsed.action;
      }
      return parsed.target ? { type: 'press', key: parsed.key, target: parsed.target } : parsed;
    }

    if (parsed.type === 'upload' && typeof parsed.target === 'string' && Array.isArray(parsed.filePaths)) {
      if (
        parsed.filePaths.length === 0 ||
        parsed.filePaths.some((item) => typeof item !== 'string' || item.trim().length === 0)
      ) {
        throw new Error('Invalid upload file paths.');
      }
      if (reparsed.ok && reparsed.action.type === 'upload') {
        return reparsed.action;
      }
      return { type: 'upload', target: parsed.target, filePaths: parsed.filePaths };
    }

    if (parsed.type === 'dialog' && (parsed.action === 'accept' || parsed.action === 'dismiss')) {
      if (parsed.promptText !== undefined && typeof parsed.promptText !== 'string') {
        throw new Error('Invalid dialog prompt text.');
      }
      if (reparsed.ok && reparsed.action.type === 'dialog') {
        return reparsed.action;
      }
      return parsed.promptText
        ? { type: 'dialog', action: parsed.action, promptText: parsed.promptText }
        : { type: 'dialog', action: parsed.action };
    }

    if (parsed.type === 'waitForRequest' && typeof parsed.urlPattern === 'string') {
      if (parsed.method !== undefined && typeof parsed.method !== 'string') {
        throw new Error('Invalid request method.');
      }
      if (parsed.status !== undefined && (!Number.isInteger(parsed.status) || parsed.status < 100 || parsed.status > 599)) {
        throw new Error('Invalid request status code.');
      }
      if (parsed.triggerClickTarget !== undefined && typeof parsed.triggerClickTarget !== 'string') {
        throw new Error('Invalid request click target.');
      }
      if (parsed.timeoutSeconds !== undefined && (!Number.isFinite(parsed.timeoutSeconds) || parsed.timeoutSeconds <= 0)) {
        throw new Error('Invalid request timeout.');
      }
      if (reparsed.ok && reparsed.action.type === 'waitForRequest') {
        return reparsed.action;
      }
      return parsed;
    }

    if (parsed.type === 'download' && typeof parsed.triggerClickTarget === 'string') {
      if (parsed.timeoutSeconds !== undefined && (!Number.isFinite(parsed.timeoutSeconds) || parsed.timeoutSeconds <= 0)) {
        throw new Error('Invalid download timeout.');
      }
      if (reparsed.ok && reparsed.action.type === 'download') {
        return reparsed.action;
      }
      return parsed;
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

function matchesUrlPattern(url: string, pattern: string): boolean {
  const normalizedPattern = pattern.trim();
  if (!normalizedPattern) {
    return false;
  }

  if (!normalizedPattern.includes('*')) {
    return url.includes(normalizedPattern);
  }

  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<DOUBLE_WILDCARD>>>')
    .replace(/\*/g, '[^\\s]*')
    .replace(/<<<DOUBLE_WILDCARD>>>/g, '.*');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(url);
}

function buildElementSelectorCandidates(target: string): string[] {
  const normalized = target.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('.')) {
    const className = normalized.slice(1).trim();
    if (!className) {
      return [];
    }

    const selectors = [`[class~="${escapeAttributeValue(className)}"]`];
    if (isSimpleCssClass(className)) {
      selectors.unshift(`.${className}`);
    }

    return selectors;
  }

  if (normalized.startsWith('#')) {
    const idValue = normalized.slice(1).trim();
    if (!idValue) {
      return [];
    }

    const selectors = [`[id="${escapeAttributeValue(idValue)}"]`];
    if (isSimpleCssId(idValue)) {
      selectors.push(`#${idValue}`);
    }

    return selectors;
  }

  const selectors = [
    `[data-testid="${escapeAttributeValue(normalized)}"]`,
    `[data-test-id="${escapeAttributeValue(normalized)}"]`,
    `[id="${escapeAttributeValue(normalized)}"]`,
  ];

  if (isSimpleCssId(normalized)) {
    selectors.push(`#${normalized}`);
  }

  return selectors;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isSimpleCssId(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9:_-]*$/.test(value);
}

function isSimpleCssClass(value: string): boolean {
  return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(value);
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
