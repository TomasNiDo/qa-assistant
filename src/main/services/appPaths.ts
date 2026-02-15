import { app } from 'electron';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface AppPaths {
  root: string;
  artifacts: string;
  dbFile: string;
  configFile: string;
}

export function getAppPaths(): AppPaths {
  const root = resolveDataRoot();
  const artifacts = join(root, 'artifacts');
  const dbFile = join(root, 'db.sqlite');
  const configFile = join(root, 'config.json');

  mkdirSync(root, { recursive: true });
  mkdirSync(artifacts, { recursive: true });

  return { root, artifacts, dbFile, configFile };
}

function resolveDataRoot(): string {
  const overrideRoot = process.env.QA_ASSISTANT_DATA_ROOT?.trim();
  if (overrideRoot) {
    return resolve(overrideRoot);
  }

  const appData = app.getPath('appData');
  const canonicalRoot = join(appData, 'qa-assistant');
  const userDataRoot = join(app.getPath('userData'), 'qa-assistant');
  const legacyElectronRoot = join(appData, 'Electron', 'qa-assistant');
  const legacyNestedRoot = join(appData, 'qa-assistant', 'qa-assistant');

  const roots = unique([canonicalRoot, userDataRoot, legacyElectronRoot, legacyNestedRoot]);
  const scored = roots.map((root) => {
    const dbFile = join(root, 'db.sqlite');
    return {
      root,
      projectCount: getProjectCount(dbFile),
      modifiedMs: getModifiedMs(dbFile),
    };
  });

  const populated = scored
    .filter((candidate) => candidate.projectCount > 0)
    .sort((a, b) =>
      a.projectCount === b.projectCount
        ? b.modifiedMs - a.modifiedMs
        : b.projectCount - a.projectCount,
    );

  if (populated.length > 0) {
    return populated[0].root;
  }

  return canonicalRoot;
}

function getProjectCount(dbFile: string): number {
  if (!existsSync(dbFile)) {
    return 0;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(dbFile, { readonly: true, fileMustExist: true });
    const row = db.prepare('SELECT COUNT(*) as count FROM projects').get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  } catch {
    return 0;
  } finally {
    db?.close();
  }
}

function getModifiedMs(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
