import type Database from 'better-sqlite3';
import type { CreateTestInput, Step, TestCase, UpdateTestInput } from '@shared/types';
import { parseStep } from './parserService';
import { createId } from './id';
import { nowIso } from './time';

export class TestCaseService {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateTestInput): TestCase {
    const timestamp = nowIso();
    const testCase: TestCase = {
      id: createId(),
      projectId: input.projectId,
      title: input.title.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const transaction = this.db.transaction((payload: CreateTestInput) => {
      this.db
        .prepare(
          `INSERT INTO test_cases (id, project_id, title, created_at, updated_at)
           VALUES (@id, @projectId, @title, @createdAt, @updatedAt)`,
        )
        .run(testCase);

      this.saveSteps(testCase.id, payload.steps);
    });

    transaction(input);
    return testCase;
  }

  update(input: UpdateTestInput): TestCase {
    const existing = this.getById(input.id);
    if (!existing) {
      throw new Error('Test case not found.');
    }

    const updated: TestCase = {
      ...existing,
      projectId: input.projectId,
      title: input.title.trim(),
      updatedAt: nowIso(),
    };

    const transaction = this.db.transaction((payload: UpdateTestInput) => {
      this.db
        .prepare(
          `UPDATE test_cases
           SET project_id = @projectId, title = @title, updated_at = @updatedAt
           WHERE id = @id`,
        )
        .run(updated);

      this.db.prepare('DELETE FROM steps WHERE test_case_id = ?').run(updated.id);
      this.saveSteps(updated.id, payload.steps);
    });

    transaction(input);
    return updated;
  }

  delete(id: string): boolean {
    const running = this.db
      .prepare(
        `SELECT id
         FROM runs
         WHERE test_case_id = ? AND status = 'running'
         LIMIT 1`,
      )
      .get(id) as { id: string } | undefined;
    if (running) {
      throw new Error('Cannot delete test case while a run is in progress for this test case.');
    }

    const result = this.db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(projectId: string): TestCase[] {
    const rows = this.db
      .prepare(
        `SELECT id, project_id, title, created_at, updated_at
         FROM test_cases
         WHERE project_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(projectId) as Array<{
      id: string;
      project_id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(toTestCase);
  }

  listSteps(testCaseId: string): Step[] {
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
    }));
  }

  getById(id: string): TestCase | null {
    const row = this.db
      .prepare(
        `SELECT id, project_id, title, created_at, updated_at
         FROM test_cases
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          project_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    return row ? toTestCase(row) : null;
  }

  private saveSteps(testCaseId: string, rawSteps: string[]): void {
    const insertStatement = this.db.prepare(
      `INSERT INTO steps (id, test_case_id, step_order, raw_text, action_json)
       VALUES (?, ?, ?, ?, ?)`,
    );

    rawSteps.forEach((rawText, index) => {
      const parsed = parseStep(rawText);
      if (!parsed.ok) {
        throw new Error(`Step ${index + 1}: ${parsed.error}`);
      }

      insertStatement.run(
        createId(),
        testCaseId,
        index + 1,
        rawText.trim(),
        JSON.stringify(parsed.action),
      );
    });
  }
}

function toTestCase(row: {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}): TestCase {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
