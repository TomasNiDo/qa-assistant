import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import DatabaseCtor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../database';

interface TempDbContext {
  dir: string;
  file: string;
  db: Database.Database;
}

function createTempDatabase(): TempDbContext {
  const dir = mkdtempSync(join(tmpdir(), 'qa-assistant-db-it-'));
  const file = join(dir, 'qa-assistant.sqlite');
  const db = openDatabase(file);
  return { dir, file, db };
}

describe('database integration', () => {
  const cleanupDirs = new Set<string>();
  let activeDb: Database.Database | null = null;

  afterEach(() => {
    activeDb?.close();
    activeDb = null;

    for (const dir of cleanupDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanupDirs.clear();
  });

  it('applies migrations once and keeps schema idempotent across reopen', () => {
    const ctx = createTempDatabase();
    activeDb = ctx.db;
    cleanupDirs.add(ctx.dir);

    const tables = new Set(
      ctx.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name),
    );

    expect(tables.has('migrations')).toBe(true);
    expect(tables.has('projects')).toBe(true);
    expect(tables.has('features')).toBe(true);
    expect(tables.has('test_cases')).toBe(true);
    expect(tables.has('steps')).toBe(true);
    expect(tables.has('runs')).toBe(true);
    expect(tables.has('step_results')).toBe(true);

    const firstPassRows = ctx.db
      .prepare('SELECT id FROM migrations ORDER BY id ASC')
      .all() as Array<{ id: string }>;
    expect(firstPassRows.length).toBeGreaterThan(0);

    ctx.db.close();
    activeDb = null;

    const reopened = openDatabase(ctx.file);
    activeDb = reopened;

    const secondPassRows = reopened
      .prepare('SELECT id FROM migrations ORDER BY id ASC')
      .all() as Array<{ id: string }>;
    expect(secondPassRows).toEqual(firstPassRows);
  });

  it('enforces foreign keys and cascades deletes through runtime tables', () => {
    const ctx = createTempDatabase();
    activeDb = ctx.db;
    cleanupDirs.add(ctx.dir);
    const now = new Date().toISOString();

    expect(() =>
      ctx.db
        .prepare(
          `INSERT INTO test_cases (id, project_id, feature_id, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('test-orphan', 'missing-project', 'missing-feature', 'Orphan test', now, now),
    ).toThrow(/FOREIGN KEY/);

    ctx.db
      .prepare(
        `INSERT INTO projects (id, name, base_url, env_label, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('project-1', 'Checkout', 'https://example.com', 'local', '{}', now);
    ctx.db
      .prepare(
        `INSERT INTO features (
           id,
           project_id,
           title,
           acceptance_criteria,
           requirements,
           notes,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'feature-1',
        'project-1',
        'Checkout planning',
        'Checkout should complete successfully.',
        null,
        null,
        now,
        now,
      );
    ctx.db
      .prepare(
        `INSERT INTO test_cases (id, project_id, feature_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('test-1', 'project-1', 'feature-1', 'Checkout flow', now, now);
    ctx.db
      .prepare(
        `INSERT INTO steps (id, test_case_id, step_order, raw_text, action_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('step-1', 'test-1', 1, 'Expect checkout page', '{"type":"expect","assertion":"checkout"}');
    ctx.db
      .prepare(
        `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('run-1', 'test-1', 'chromium', 'failed', now, now);
    ctx.db
      .prepare(
        `INSERT INTO step_results (id, run_id, step_id, status, error_text, screenshot_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('result-1', 'run-1', 'step-1', 'failed', 'timed out', null);

    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM test_cases').get() as { count: number }).count,
    ).toBe(1);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM steps').get() as { count: number }).count,
    ).toBe(1);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM runs').get() as { count: number }).count,
    ).toBe(1);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM step_results').get() as { count: number }).count,
    ).toBe(1);

    ctx.db.prepare('DELETE FROM projects WHERE id = ?').run('project-1');

    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM test_cases').get() as { count: number }).count,
    ).toBe(0);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM steps').get() as { count: number }).count,
    ).toBe(0);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM runs').get() as { count: number }).count,
    ).toBe(0);
    expect(
      (ctx.db.prepare('SELECT COUNT(*) AS count FROM step_results').get() as { count: number }).count,
    ).toBe(0);
  });

  it('migrates legacy project test cases into Imported features', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-assistant-db-migrate-it-'));
    const file = join(dir, 'qa-assistant.sqlite');
    cleanupDirs.add(dir);
    const now = new Date().toISOString();
    const legacyDb = new DatabaseCtor(file);
    legacyDb.pragma('foreign_keys = ON');
    legacyDb.exec(
      readFileSync(
        join(process.cwd(), 'src/main/db/migrations/001_initial.sql'),
        'utf8',
      ),
    );
    legacyDb.exec(
      readFileSync(
        join(process.cwd(), 'src/main/db/migrations/002_test_case_code_fields.sql'),
        'utf8',
      ),
    );
    legacyDb
      .prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)')
      .run('001_initial.sql', now);
    legacyDb
      .prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)')
      .run('002_test_case_code_fields.sql', now);

    legacyDb
      .prepare(
        `INSERT INTO projects (id, name, base_url, env_label, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('project-legacy', 'Legacy Project', 'https://example.com', 'legacy', '{}', now);
    legacyDb
      .prepare(
        `INSERT INTO test_cases (
           id,
           project_id,
           title,
           generated_code,
           custom_code,
           is_customized,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'test-legacy',
        'project-legacy',
        'Legacy test',
        '',
        null,
        0,
        now,
        now,
      );
    legacyDb.close();

    const migrated = openDatabase(file);
    activeDb = migrated;

    const importedFeature = migrated
      .prepare(
        `SELECT id, project_id, title
         FROM features
         WHERE project_id = ? AND title = 'Imported'`,
      )
      .get('project-legacy') as { id: string; project_id: string; title: string } | undefined;

    expect(importedFeature).toBeDefined();

    const migratedTest = migrated
      .prepare(
        `SELECT id, project_id, feature_id
         FROM test_cases
         WHERE id = ?`,
      )
      .get('test-legacy') as { id: string; project_id: string; feature_id: string } | undefined;

    expect(migratedTest).toBeDefined();
    expect(migratedTest?.project_id).toBe('project-legacy');
    expect(migratedTest?.feature_id).toBe(importedFeature?.id);
  });
});
