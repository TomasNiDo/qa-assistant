import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import type {
  BrowserInstallPhase,
  BrowserInstallState,
  BrowserInstallUpdate,
  BrowserName,
} from '@shared/types';

const require = createRequire(import.meta.url);
const PLAYWRIGHT_CLI_PATH = join(
  dirname(require.resolve('playwright/package.json')),
  'cli.js',
);

const ALL_BROWSERS: BrowserName[] = ['chromium', 'firefox', 'webkit'];

export class BrowserService {
  private readonly installPromises = new Map<BrowserName, Promise<void>>();
  private readonly lastErrors = new Map<BrowserName, string>();
  private emitInstallUpdate: (event: BrowserInstallUpdate) => void = () => undefined;

  setInstallUpdateEmitter(emitter: (event: BrowserInstallUpdate) => void): void {
    this.emitInstallUpdate = emitter;
  }

  getStatuses(): BrowserInstallState[] {
    return ALL_BROWSERS.map((browser) => this.getStatus(browser));
  }

  getStatus(browser: BrowserName): BrowserInstallState {
    const executablePath = this.getExecutablePath(browser);
    return {
      browser,
      installed: executablePath ? existsSync(executablePath) : false,
      installInProgress: this.installPromises.has(browser),
      executablePath,
      lastError: this.lastErrors.get(browser) ?? null,
    };
  }

  async ensureInstalled(browser: BrowserName): Promise<void> {
    if (this.getStatus(browser).installed) {
      return;
    }

    await this.install(browser);
  }

  async install(browser: BrowserName): Promise<void> {
    const inFlight = this.installPromises.get(browser);
    if (inFlight) {
      this.emitProgress(browser, 'installing', null, `${browser} install already in progress.`);
      await inFlight;
      return;
    }

    this.emitProgress(browser, 'starting', 0, `Starting ${browser} install...`);

    const installTask = this.runInstall(browser)
      .then(() => {
        this.lastErrors.delete(browser);
        this.emitProgress(browser, 'completed', 100, `${browser} installed.`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to install browser.';
        this.lastErrors.set(browser, message);
        this.emitProgress(browser, 'failed', null, message);
        throw new Error(message);
      })
      .finally(() => {
        this.installPromises.delete(browser);
      });

    this.installPromises.set(browser, installTask);
    await installTask;
  }

  async launch(browser: BrowserName): Promise<PlaywrightBrowser> {
    return this.getBrowserType(browser).launch({ headless: true });
  }

  private getExecutablePath(browser: BrowserName): string | null {
    try {
      return this.getBrowserType(browser).executablePath();
    } catch {
      return null;
    }
  }

  private getBrowserType(browser: BrowserName): BrowserType {
    if (browser === 'firefox') {
      return firefox;
    }

    if (browser === 'webkit') {
      return webkit;
    }

    return chromium;
  }

  private runInstall(browser: BrowserName): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [PLAYWRIGHT_CLI_PATH, 'install', browser], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      const stdoutState = { value: '' };
      const stderrState = { value: '' };
      let fallbackProgress = 3;

      const consume = (text: string) => {
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const phase = inferPhase(trimmed);
          const parsed = parseProgress(trimmed);
          let progress = parsed;

          if (progress === null) {
            fallbackProgress = Math.min(96, fallbackProgress + 2);
            progress = fallbackProgress;
          } else {
            fallbackProgress = Math.max(fallbackProgress, progress);
          }

          this.emitProgress(browser, phase, progress, trimmed);
        }
      };

      const onChunk =
        (bufferRef: { value: string }) =>
        (chunk: Buffer | string): void => {
          const text = chunk.toString();
          output += text;
          bufferRef.value += text;

          const parts = bufferRef.value.split(/\r?\n/);
          bufferRef.value = parts.pop() ?? '';
          consume(parts.join('\n'));
        };

      child.stdout.on('data', onChunk(stdoutState));
      child.stderr.on('data', onChunk(stderrState));

      child.once('error', (error) => {
        reject(new Error(`Playwright browser install failed to start: ${error.message}`));
      });

      child.once('exit', (code) => {
        if (stdoutState.value.trim()) {
          consume(stdoutState.value);
        }
        if (stderrState.value.trim()) {
          consume(stderrState.value);
        }

        if (code === 0) {
          resolve();
          return;
        }

        const details = output.trim();
        reject(new Error(details || `Playwright install exited with code ${code ?? 'unknown'}.`));
      });
    });
  }

  private emitProgress(
    browser: BrowserName,
    phase: BrowserInstallPhase,
    progress: number | null,
    message: string,
  ): void {
    this.emitInstallUpdate({
      browser,
      phase,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

function parseProgress(text: string): number | null {
  const percentageMatch = text.match(/(\d{1,3})%/);
  if (!percentageMatch) {
    return null;
  }

  const parsed = Number(percentageMatch[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(100, parsed));
}

function inferPhase(text: string): BrowserInstallPhase {
  if (/download/i.test(text)) {
    return 'downloading';
  }

  if (/extract|unpack|decompress|copy/i.test(text)) {
    return 'installing';
  }

  if (/verif|valid|done|installed|complete/i.test(text)) {
    return 'verifying';
  }

  return 'installing';
}
