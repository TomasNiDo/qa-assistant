import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DatabaseContext {
  db: Database.Database;
}

export function openDatabase(dbFilePath: string): Database.Database {
  const db = new Database(dbFilePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = join(process.cwd(), 'src', 'main', 'db', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const getAppliedStatement = db.prepare('SELECT id FROM migrations WHERE id = ?');
  const markAppliedStatement = db.prepare(
    'INSERT INTO migrations (id, applied_at) VALUES (?, ?)',
  );

  for (const fileName of migrationFiles) {
    const alreadyApplied = getAppliedStatement.get(fileName) as { id: string } | undefined;
    if (alreadyApplied) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, fileName), 'utf8');

    db.exec('BEGIN');
    try {
      db.exec(sql);
      markAppliedStatement.run(fileName, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
