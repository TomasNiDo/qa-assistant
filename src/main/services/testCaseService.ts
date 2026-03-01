import type Database from 'better-sqlite3';
import {
  formatCustomCodeSyntaxError,
  validateCustomCodeSyntax,
} from '@shared/customCodeValidation';
import type {
  CreateTestInput,
  CustomCodeSyntaxValidationResult,
  ParsedAction,
  Step,
  TestCase,
  UpdateTestInput,
} from '@shared/types';
import { parseStep } from './parserService';
import {
  ensurePlaywrightTestWrapper,
  generatePlaywrightCode,
  repairLegacyPlaywrightCode,
} from './playwrightCodegen';
import { createId } from './id';
import { nowIso } from './time';

export class TestCaseService {
  constructor(private readonly db: Database.Database) {}

  validateCustomCodeSyntax(customCode: string): CustomCodeSyntaxValidationResult {
    const validation = validateCustomCodeSyntax(customCode);
    if (validation.valid) {
      return validation;
    }

    return {
      ...validation,
      message: formatCustomCodeSyntaxError(validation),
    };
  }

  create(input: CreateTestInput): TestCase {
    const timestamp = nowIso();
    const feature = this.getFeatureOwnership(input.featureId);
    const rawSteps = input.steps ?? [];
    const parsedSteps = this.parseSteps(rawSteps);
    const generatedCode = generatePlaywrightCode(parsedSteps.map((step) => step.action), {
      testTitle: input.title.trim(),
      stepComments: parsedSteps.map((step) => step.rawText),
    });
    const codeFields = resolveCodeFields({
      generatedCode,
      isCustomized: input.isCustomized,
      customCode: input.customCode,
    });

    const testCase: TestCase = {
      id: createId(),
      projectId: feature.projectId,
      featureId: feature.featureId,
      title: input.title.trim(),
      testType: input.testType ?? 'positive',
      priority: input.priority ?? 'medium',
      planningStatus: input.planningStatus ?? 'drafted',
      isAiGenerated: Boolean(input.isAiGenerated),
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
             feature_id,
             title,
             test_type,
             priority,
             planning_status,
             is_ai_generated,
             generated_code,
             custom_code,
             is_customized,
             created_at,
             updated_at
           )
           VALUES (
             @id,
             @projectId,
             @featureId,
             @title,
             @testType,
             @priority,
             @planningStatus,
             @isAiGenerated,
             @generatedCode,
             @customCode,
             @isCustomized,
             @createdAt,
             @updatedAt
           )`,
        )
        .run({
          ...testCase,
          isAiGenerated: testCase.isAiGenerated ? 1 : 0,
          isCustomized: testCase.isCustomized ? 1 : 0,
        });

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

    const feature = this.getFeatureOwnership(input.featureId);
    const updateSteps = input.steps !== undefined;
    const inputSteps = input.steps ?? [];
    const parsedSteps = updateSteps ? this.parseSteps(inputSteps) : [];
    const regeneratedCode = updateSteps
      ? generatePlaywrightCode(parsedSteps.map((step) => step.action), {
          testTitle: input.title.trim(),
          stepComments: parsedSteps.map((step) => step.rawText),
        })
      : undefined;

    const codeFields = resolveCodeFields({
      generatedCode: existing.generatedCode,
      isCustomized: input.isCustomized ?? existing.isCustomized,
      customCode: input.customCode ?? existing.customCode,
      regeneratedCode,
    });

    const updated: TestCase = {
      ...existing,
      projectId: feature.projectId,
      featureId: feature.featureId,
      title: input.title.trim(),
      testType: input.testType ?? existing.testType,
      priority: input.priority ?? existing.priority,
      planningStatus: input.planningStatus ?? existing.planningStatus,
      isAiGenerated: input.isAiGenerated ?? existing.isAiGenerated,
      updatedAt: nowIso(),
      ...codeFields,
    };

    const transaction = this.db.transaction((payloadParsedSteps?: ParsedStepRow[]) => {
      this.db
        .prepare(
          `UPDATE test_cases
           SET project_id = @projectId,
               feature_id = @featureId,
               title = @title,
               test_type = @testType,
               priority = @priority,
               planning_status = @planningStatus,
               is_ai_generated = @isAiGenerated,
               generated_code = @generatedCode,
               custom_code = @customCode,
               is_customized = @isCustomized,
               updated_at = @updatedAt
           WHERE id = @id`,
        )
        .run({
          ...updated,
          isAiGenerated: updated.isAiGenerated ? 1 : 0,
          isCustomized: updated.isCustomized ? 1 : 0,
        });

      if (payloadParsedSteps) {
        this.db.prepare('DELETE FROM steps WHERE test_case_id = ?').run(updated.id);
        this.saveParsedSteps(updated.id, payloadParsedSteps);
      }
    });

    transaction(updateSteps ? parsedSteps : undefined);
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

  listByFeature(featureId: string): TestCase[] {
    const rows = this.db
      .prepare(
        `SELECT id,
                project_id,
                feature_id,
                title,
                test_type,
                priority,
                planning_status,
                is_ai_generated,
                generated_code,
                custom_code,
                is_customized,
                created_at,
                updated_at
         FROM test_cases
         WHERE feature_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(featureId) as TestCaseRow[];

    return rows.map(toTestCase);
  }

  listByProject(projectId: string): TestCase[] {
    const rows = this.db
      .prepare(
        `SELECT id,
                project_id,
                feature_id,
                title,
                test_type,
                priority,
                planning_status,
                is_ai_generated,
                generated_code,
                custom_code,
                is_customized,
                created_at,
                updated_at
         FROM test_cases
         WHERE project_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(projectId) as TestCaseRow[];

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
        `SELECT id,
                project_id,
                feature_id,
                title,
                test_type,
                priority,
                planning_status,
                is_ai_generated,
                generated_code,
                custom_code,
                is_customized,
                created_at,
                updated_at
         FROM test_cases
         WHERE id = ?`,
      )
      .get(id) as TestCaseRow | undefined;

    return row ? toTestCase(row) : null;
  }

  private getFeatureOwnership(featureId: string): { featureId: string; projectId: string } {
    const row = this.db
      .prepare(
        `SELECT id, project_id
         FROM features
         WHERE id = ?`,
      )
      .get(featureId) as
      | {
          id: string;
          project_id: string;
        }
      | undefined;

    if (!row) {
      throw new Error('Feature not found.');
    }

    return {
      featureId: row.id,
      projectId: row.project_id,
    };
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

interface TestCaseRow {
  id: string;
  project_id: string;
  feature_id: string;
  title: string;
  test_type: TestCase['testType'];
  priority: TestCase['priority'];
  planning_status: TestCase['planningStatus'];
  is_ai_generated: number;
  generated_code: string;
  custom_code: string | null;
  is_customized: number;
  created_at: string;
  updated_at: string;
}

function toTestCase(row: TestCaseRow): TestCase {
  const generatedCode = ensurePlaywrightTestWrapper(row.generated_code, row.title);
  const customCode = row.custom_code
    ? ensurePlaywrightTestWrapper(row.custom_code, row.title)
    : null;

  return {
    id: row.id,
    projectId: row.project_id,
    featureId: row.feature_id,
    title: row.title,
    testType: row.test_type,
    priority: row.priority,
    planningStatus: row.planning_status,
    isAiGenerated: row.is_ai_generated === 1,
    generatedCode,
    customCode,
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
  const normalizedGeneratedCode = repairLegacyPlaywrightCode(
    input.regeneratedCode ?? input.generatedCode,
  );

  if (!isCustomized) {
    return {
      generatedCode: normalizedGeneratedCode,
      customCode: null,
      isCustomized: false,
    };
  }

  const customCode = repairLegacyPlaywrightCode(input.customCode ?? input.generatedCode).trim();
  if (!customCode) {
    throw new Error('Custom code cannot be empty when customization is enabled.');
  }

  const syntaxValidation = validateCustomCodeSyntax(customCode);
  if (!syntaxValidation.valid) {
    throw new Error(formatCustomCodeSyntaxError(syntaxValidation));
  }

  return {
    generatedCode: repairLegacyPlaywrightCode(input.generatedCode),
    customCode,
    isCustomized: true,
  };
}
