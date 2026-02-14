import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface AppPaths {
  root: string;
  artifacts: string;
  dbFile: string;
}

export function getAppPaths(): AppPaths {
  const root = join(app.getPath('userData'), 'qa-assistant');
  const artifacts = join(root, 'artifacts');
  const dbFile = join(root, 'db.sqlite');

  mkdirSync(root, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  return { root, artifacts, dbFile };
}
