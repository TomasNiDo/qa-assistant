import { app, BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { registerHandlers } from './ipc/registerHandlers';
import { getAppPaths } from './services/appPaths';
import { openDatabase } from './services/database';
import { createServices } from './services/services';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolvePreloadPath(): string {
  const candidates = [join(__dirname, '../preload/index.mjs'), join(__dirname, '../preload/index.js')];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`Preload script not found. Checked: ${candidates.join(', ')}`);
  }

  return match;
}

async function createWindow(): Promise<void> {
  const preloadPath = resolvePreloadPath();

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  const paths = getAppPaths();
  const db = openDatabase(paths.dbFile);
  const services = createServices(db, paths.artifacts, paths.configFile);

  registerHandlers(services);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
