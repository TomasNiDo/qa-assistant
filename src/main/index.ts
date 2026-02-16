import { app, BrowserWindow, session } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from '@shared/ipc';
import dotenv from 'dotenv';
import { registerHandlers } from './ipc/registerHandlers';
import { buildRendererCsp, isAllowedNavigationUrl, validateRendererDevUrl } from './security';
import { getAppPaths } from './services/appPaths';
import { openDatabase } from './services/database';
import { createServices } from './services/services';

dotenv.config();

// Guard against accidental Node-mode Electron, which breaks helper processes.
if (process.env.ELECTRON_RUN_AS_NODE) {
  delete process.env.ELECTRON_RUN_AS_NODE;
}

// Suppress harmless DevTools Autofill warnings that appear in stderr.
// These errors originate from Chrome DevTools trying to enable features not available in Electron.
// They don't affect app functionality and cannot be suppressed via command-line switches.
// See: https://github.com/electron/electron/issues/41614
if (!app.isPackaged) {
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stderr.write = ((chunk: string | Uint8Array, ...args: any[]): boolean => {
    const message = typeof chunk === 'string' ? chunk : chunk.toString();
    if (
      message.includes("'Autofill.enable' wasn't found") ||
      message.includes("'Autofill.setAddresses' wasn't found")
    ) {
      // Suppress these harmless DevTools warnings
      return true;
    }
    return originalStderrWrite(chunk, ...args);
  }) as typeof process.stderr.write;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolvePreloadPath(): string {
  const candidates = [
    join(__dirname, '../preload/index.js'),
    join(__dirname, '../preload/index.cjs'),
    join(__dirname, '../preload/index.mjs'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`Preload script not found. Checked: ${candidates.join(', ')}`);
  }

  return match;
}

function setupAutoUpdater(): void {
  if (!app.isPackaged || process.platform !== 'win32') {
    return;
  }

  // Keep prerelease channels enabled while the app is on a beta version.
  autoUpdater.allowPrerelease = app.getVersion().includes('-');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error) => {
    console.error('[auto-updater] Error while checking/applying updates:', error);
  });

  autoUpdater.on('update-available', (info) => {
    console.info(`[auto-updater] Update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.info('[auto-updater] No update available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.info(`[auto-updater] Update downloaded: ${info.version}. It will install on app quit.`);
  });

  void autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.error('[auto-updater] Failed to start update check:', error);
  });
}

async function createWindow(rendererDevUrl: URL | null): Promise<void> {
  const preloadPath = resolvePreloadPath();
  const allowedDevOrigin = rendererDevUrl?.origin;

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url, allowedDevOrigin)) {
      event.preventDefault();
    }
  });
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  if (rendererDevUrl) {
    await win.loadURL(rendererDevUrl.toString());
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  const paths = getAppPaths();
  const db = openDatabase(paths.dbFile);
  const rawRendererUrl = process.env.ELECTRON_RENDERER_URL?.trim();
  const rendererDevUrl = rawRendererUrl ? validateRendererDevUrl(rawRendererUrl) : null;

  if (process.env.QA_ASSISTANT_SMOKE_STARTUP === '1') {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(rows.map((row) => row.name));
    const requiredTables = ['migrations', 'projects', 'test_cases', 'steps', 'runs', 'step_results'];

    for (const tableName of requiredTables) {
      if (!tableNames.has(tableName)) {
        throw new Error(`Smoke startup missing required table: ${tableName}`);
      }
    }

    db.close();
    app.quit();
    return;
  }

  const csp = buildRendererCsp({ allowUnsafeInlineScripts: Boolean(rendererDevUrl) });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  const services = createServices(db, paths.artifacts, paths.configFile);

  registerHandlers(services);
  setupAutoUpdater();
  services.runService.setRunUpdateEmitter((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.runUpdate, event);
    }
  });
  services.runService.setBrowserInstallUpdateEmitter((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.runBrowserInstallUpdate, event);
    }
  });
  await createWindow(rendererDevUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(rendererDevUrl);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
