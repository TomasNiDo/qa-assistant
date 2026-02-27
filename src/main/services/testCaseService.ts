import type Database from 'better-sqlite3';
import type { CreateTestInput, ParsedAction, Step, TestCase, UpdateTestInput } from '@shared/types';
import { parseStep } from './parserService';
import { generatePlaywrightCode } from './playwrightCodegen';
import { createId } from './id';
import { nowIso } from './time';

export class TestCaseService {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateTestInput): TestCase {
    const timestamp = nowIso();
    const parsedSteps = this.parseSteps(input.steps);
    const generatedCode = generatePlaywrightCode(parsedSteps.map((step) => step.action));
    const codeFields = resolveCodeFields({
      generatedCode,
      isCustomized: input.isCustomized,
      customCode: input.customCode,
    });

    const testCase: TestCase = {
      id: createId(),
      projectId: input.projectId,
      title: input.title.trim(),
      generatedCode: codeFields.generatedCode,
      customCode: codeFields.customCode,
      isCustomized: codeFields.isCustomized,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const transaction = this.db.transaction((payloadParsedSteps: ParsedStepRow[]) => {
      this.db
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
           VALUES (@id, @projectId, @title, @generatedCode, @customCode, @isCustomized, @createdAt, @updatedAt)`,
        )
        .run({ ...testCase, isCustomized: testCase.isCustomized ? 1 : 0 });

      this.saveParsedSteps(testCase.id, payloadParsedSteps);
    });

    transaction(parsedSteps);
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

    const parsedSteps = this.parseSteps(input.steps);
    const regeneratedCode = generatePlaywrightCode(parsedSteps.map((step) => step.action));
    const codeFields = resolveCodeFields({
      generatedCode: existing.generatedCode,
      isCustomized: input.isCustomized ?? existing.isCustomized,
      customCode: input.customCode ?? existing.customCode,
      regeneratedCode,
    });

    const transaction = this.db.transaction((payloadParsedSteps: ParsedStepRow[]) => {
      this.db
        .prepare(
          `UPDATE test_cases
           SET project_id = @projectId,
               title = @title,
               generated_code = @generatedCode,
               custom_code = @customCode,
               is_customized = @isCustomized,
               updated_at = @updatedAt
           WHERE id = @id`,
        )
        .run({
          ...updated,
          ...codeFields,
          isCustomized: codeFields.isCustomized ? 1 : 0,
        });

      this.db.prepare('DELETE FROM steps WHERE test_case_id = ?').run(updated.id);
      this.saveParsedSteps(updated.id, payloadParsedSteps);
    });

    transaction(parsedSteps);
    return {
      ...updated,
      ...codeFields,
    };
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
        `SELECT id, project_id, title, generated_code, custom_code, is_customized, created_at, updated_at
         FROM test_cases
         WHERE project_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(projectId) as Array<{
      id: string;
      project_id: string;
      title: string;
      generated_code: string;
      custom_code: string | null;
      is_customized: number;
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
        `SELECT id, project_id, title, generated_code, custom_code, is_customized, created_at, updated_at
         FROM test_cases
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          project_id: string;
          title: string;
          generated_code: string;
          custom_code: string | null;
          is_customized: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    return row ? toTestCase(row) : null;
  }

  private parseSteps(rawSteps: string[]): ParsedStepRow[] {
    return rawSteps.map((rawText, index) => {
      const parsed = parseStep(rawText);
      if (!parsed.ok) {
        throw new Error(`Step ${index + 1}: ${parsed.error}`);
      }

      return {
        rawText: rawText.trim(),
        action: parsed.action,
      };
    });
  }

  private saveParsedSteps(testCaseId: string, parsedSteps: ParsedStepRow[]): void {
    const insertStatement = this.db.prepare(
      `INSERT INTO steps (id, test_case_id, step_order, raw_text, action_json)
       VALUES (?, ?, ?, ?, ?)`,
    );

    parsedSteps.forEach((step, index) => {
      insertStatement.run(
        createId(),
        testCaseId,
        index + 1,
        step.rawText,
        JSON.stringify(step.action),
      );
    });
  }
}

function toTestCase(row: {
  id: string;
  project_id: string;
  title: string;
  generated_code: string;
  custom_code: string | null;
  is_customized: number;
  created_at: string;
  updated_at: string;
}): TestCase {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    generatedCode: row.generated_code,
    customCode: row.custom_code,
    isCustomized: row.is_customized === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ParsedStepRow {
  rawText: string;
  action: ParsedAction;
}

interface ResolveCodeFieldsInput {
  generatedCode: string;
  isCustomized?: boolean;
  customCode?: string | null;
  regeneratedCode?: string;
}

function resolveCodeFields(input: ResolveCodeFieldsInput): {
  generatedCode: string;
  customCode: string | null;
  isCustomized: boolean;
} {
  const isCustomized = Boolean(input.isCustomized);

  if (!isCustomized) {
    return {
      generatedCode: input.regeneratedCode ?? input.generatedCode,
      customCode: null,
      isCustomized: false,
    };
  }

  const customCode = (input.customCode ?? input.generatedCode).trim();
  if (!customCode) {
    throw new Error('Custom code cannot be empty when customization is enabled.');
  }

  return {
    generatedCode: input.generatedCode,
    customCode,
    isCustomized: true,
  };
}
