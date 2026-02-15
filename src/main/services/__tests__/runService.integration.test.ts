import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import type { AppConfig, BrowserInstallState } from '@shared/types';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../database';
import { BrowserService } from '../browserService';
import { ProjectService } from '../projectService';
import { RunService } from '../runService';
import { TestCaseService } from '../testCaseService';

type ExpectOutcome = 'pass' | 'fail';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

interface BrowserRuntimeOptions {
  expectOutcomes?: ExpectOutcome[];
  ensureInstalledGate?: Deferred<void>;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

class FakeLocator {
  constructor(
    private readonly page: FakePage,
    private readonly useExpectOutcomes: boolean,
  ) {}

  first(): FakeLocator {
    return this;
  }

  async fill(): Promise<void> {
    this.page.assertOpen();
  }

  async click(): Promise<void> {
    this.page.assertOpen();
  }

  async waitFor(): Promise<void> {
    this.page.assertOpen();

    if (!this.useExpectOutcomes) {
      return;
    }

    const outcome = this.page.nextExpectOutcome();
    if (outcome === 'fail') {
      throw new Error('Timeout while waiting for expected text');
    }
  }
}

class FakePage {
  private closed = false;
  private readonly expectOutcomes: ExpectOutcome[];
  private currentUrl = 'about:blank';

  public readonly keyboard = {
    type: async (): Promise<void> => {
      this.assertOpen();
    },
  };

  constructor(expectOutcomes: ExpectOutcome[]) {
    this.expectOutcomes = [...expectOutcomes];
  }

  url(): string {
    return this.currentUrl;
  }

  async goto(target: string): Promise<void> {
    this.assertOpen();
    this.currentUrl = target;
  }

  getByLabel(): FakeLocator {
    return new FakeLocator(this, false);
  }

  getByRole(): FakeLocator {
    return new FakeLocator(this, false);
  }

  getByPlaceholder(): FakeLocator {
    return new FakeLocator(this, false);
  }

  getByText(): FakeLocator {
    return new FakeLocator(this, true);
  }

  async screenshot(options: { path: string }): Promise<void> {
    this.assertOpen();
    mkdirSync(dirname(options.path), { recursive: true });
    writeFileSync(options.path, 'fake-screenshot');
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  assertOpen(): void {
    if (this.closed) {
      throw new Error('Target page, context or browser has been closed');
    }
  }

  nextExpectOutcome(): ExpectOutcome {
    return this.expectOutcomes.shift() ?? 'pass';
  }
}

class FakeBrowserContext {
  constructor(private readonly page: FakePage) {}

  async newPage(): Promise<FakePage> {
    return this.page;
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

class FakeBrowser {
  constructor(private readonly page: FakePage) {}

  async newContext(): Promise<FakeBrowserContext> {
    return new FakeBrowserContext(this.page);
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

function createBrowserServiceStub(options: BrowserRuntimeOptions): BrowserService {
  const status: BrowserInstallState = {
    browser: 'chromium',
    installed: true,
    installInProgress: false,
    executablePath: '/tmp/chromium',
    lastError: null,
  };
  const page = new FakePage(options.expectOutcomes ?? []);

  return {
    setInstallUpdateEmitter: () => undefined,
    getStatuses: () => [status],
    getStatus: () => status,
    install: async () => undefined,
    ensureInstalled: async () => {
      if (options.ensureInstalledGate) {
        await options.ensureInstalledGate.promise;
      }
    },
    launch: async () => new FakeBrowser(page),
  } as unknown as BrowserService;
}

function config(overrides?: Partial<AppConfig>): AppConfig {
  return {
    defaultBrowser: 'chromium',
    stepTimeoutSeconds: 10,
    continueOnFailure: false,
    enableSampleProjectSeed: false,
    ...overrides,
  };
}

async function waitForTerminalRun(
  service: RunService,
  runId: string,
  timeoutMs = 3000,
): Promise<{ id: string; status: string; endedAt: string | null }> {
  const start = Date.now();

  for (;;) {
    const run = service.status(runId);
    if (run && run.status !== 'running') {
      return { id: run.id, status: run.status, endedAt: run.endedAt };
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for run ${runId} to reach terminal state.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function setupRealDb(): { db: Database.Database; dir: string; artifactsDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'qa-assistant-run-it-'));
  const db = openDatabase(join(dir, 'qa-assistant.sqlite'));
  const artifactsDir = join(dir, 'artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  return { db, dir, artifactsDir };
}

function seedTestCase(db: Database.Database, steps: string[]): { testCaseId: string } {
  const projectService = new ProjectService(db);
  const testCaseService = new TestCaseService(db);
  const project = projectService.create({
    name: 'Checkout',
    baseUrl: 'https://example.com',
  });
  const testCase = testCaseService.create({
    projectId: project.id,
    title: 'Checkout flow',
    steps,
  });

  return { testCaseId: testCase.id };
}

describe('RunService integration', () => {
  let db: Database.Database | null = null;
  let tempDir: string | null = null;

  afterEach(() => {
    db?.close();
    db = null;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('starts and completes a passing run', async () => {
    const ctx = setupRealDb();
    db = ctx.db;
    tempDir = ctx.dir;

    const { testCaseId } = seedTestCase(db, ['Expect login page', 'Expect dashboard visible']);
    const service = new RunService(
      db,
      ctx.artifactsDir,
      createBrowserServiceStub({ expectOutcomes: ['pass', 'pass'] }),
      () => config(),
    );

    const run = service.start({ testCaseId, browser: 'chromium' });
    const terminal = await waitForTerminalRun(service, run.id);
    const results = service.stepResults(run.id);

    expect(terminal.status).toBe('passed');
    expect(terminal.endedAt).toBeTruthy();
    expect(results.map((result) => result.status)).toEqual(['passed', 'passed']);
    expect(results.every((result) => Boolean(result.screenshotPath))).toBe(true);
  });

  it('cancels an in-progress run and marks pending steps as cancelled', async () => {
    const ctx = setupRealDb();
    db = ctx.db;
    tempDir = ctx.dir;

    const { testCaseId } = seedTestCase(db, ['Expect login page']);
    const ensureInstalledGate = createDeferred<void>();
    const service = new RunService(
      db,
      ctx.artifactsDir,
      createBrowserServiceStub({ ensureInstalledGate }),
      () => config(),
    );

    const run = service.start({ testCaseId, browser: 'chromium' });
    expect(service.cancel(run.id)).toBe(true);
    ensureInstalledGate.resolve();

    const terminal = await waitForTerminalRun(service, run.id);
    const results = service.stepResults(run.id);

    expect(terminal.status).toBe('cancelled');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('cancelled');
    expect(results[0].errorText).toBe('Step did not run.');
    expect(service.activeContext()).toBeNull();
  });

  it('fails and cancels remaining steps when continueOnFailure is disabled', async () => {
    const ctx = setupRealDb();
    db = ctx.db;
    tempDir = ctx.dir;

    const { testCaseId } = seedTestCase(db, ['Expect first checkpoint', 'Expect second checkpoint']);
    const service = new RunService(
      db,
      ctx.artifactsDir,
      createBrowserServiceStub({ expectOutcomes: ['fail', 'pass'] }),
      () => config({ continueOnFailure: false }),
    );

    const run = service.start({ testCaseId, browser: 'chromium' });
    const terminal = await waitForTerminalRun(service, run.id);
    const results = service.stepResults(run.id);

    expect(terminal.status).toBe('failed');
    expect(results.map((result) => result.status)).toEqual(['failed', 'cancelled']);
    expect(results[0].errorText).toContain('Step timed out');
  });

  it('continues after failures when continueOnFailure is enabled', async () => {
    const ctx = setupRealDb();
    db = ctx.db;
    tempDir = ctx.dir;

    const { testCaseId } = seedTestCase(db, ['Expect first checkpoint', 'Expect second checkpoint']);
    const service = new RunService(
      db,
      ctx.artifactsDir,
      createBrowserServiceStub({ expectOutcomes: ['fail', 'pass'] }),
      () => config({ continueOnFailure: true }),
    );

    const run = service.start({ testCaseId, browser: 'chromium' });
    const terminal = await waitForTerminalRun(service, run.id);
    const results = service.stepResults(run.id);

    expect(terminal.status).toBe('failed');
    expect(results.map((result) => result.status)).toEqual(['failed', 'passed']);
    expect(results[1].errorText).toBeNull();
  });
});
