import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface AppPaths {
  root: string;
  artifacts: string;
  dbFile: string;
  configFile: string;
}

export function getAppPaths(): AppPaths {
  const root = join(app.getPath('userData'), 'qa-assistant');
  const artifacts = join(root, 'artifacts');
  const dbFile = join(root, 'db.sqlite');
  const configFile = join(root, 'config.json');

  mkdirSync(root, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  return { root, artifacts, dbFile, configFile };
}
