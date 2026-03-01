import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { FeatureService } from '../featureService';
import { ProjectService } from '../projectService';
import { TestCaseService } from '../testCaseService';
import { createTestDb } from './testDb';

describe('TestCaseService', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  function createProjectAndFeature(): {
    projectService: ProjectService;
    featureService: FeatureService;
    testCaseService: TestCaseService;
    projectId: string;
    featureId: string;
  } {
    db = createTestDb();
    const projectService = new ProjectService(db);
    const featureService = new FeatureService(db);
    const testCaseService = new TestCaseService(db);
    const project = projectService.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });
    const feature = featureService.create({
      projectId: project.id,
      title: 'Login planning',
      acceptanceCriteria: 'User can log in with valid credentials.',
    });

    return {
      projectService,
      featureService,
      testCaseService,
      projectId: project.id,
      featureId: feature.id,
    };
  }

  it('creates test cases and persists parsed steps in order', () => {
    const { testCaseService, projectId, featureId } = createProjectAndFeature();

    const created = testCaseService.create({
      featureId,
      title: 'Login flow',
      testType: 'positive',
      priority: 'high',
      isAiGenerated: true,
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    expect(created.projectId).toBe(projectId);
    expect(created.featureId).toBe(featureId);
    expect(created.testType).toBe('positive');
    expect(created.priority).toBe('high');
    expect(created.planningStatus).toBe('drafted');
    expect(created.isAiGenerated).toBe(true);
    expect(created.generatedCode).toContain("import { test, expect } from '@playwright/test';");
    expect(testCaseService.listByFeature(featureId)).toHaveLength(1);

    const steps = testCaseService.listSteps(created.id);
    expect(steps.map((step) => step.stepOrder)).toEqual([1, 2]);
    expect(JSON.parse(steps[0].actionJson)).toEqual({ type: 'click', target: 'Sign in' });
  });

  it('supports planning-only saves without steps', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    const created = testCaseService.create({
      featureId,
      title: 'Edge plan only',
      testType: 'edge',
      priority: 'low',
      isAiGenerated: false,
    });

    expect(created.testType).toBe('edge');
    expect(created.priority).toBe('low');
    expect(created.planningStatus).toBe('drafted');
    expect(testCaseService.listSteps(created.id)).toHaveLength(0);
  });

  it('updates test case metadata and step ordering', () => {
    const { featureService, testCaseService, projectId, featureId } = createProjectAndFeature();

    const secondFeature = featureService.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout works',
    });

    const created = testCaseService.create({
      featureId,
      title: 'Login flow',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    const updated = testCaseService.update({
      id: created.id,
      featureId: secondFeature.id,
      title: 'Updated login flow',
      testType: 'negative',
      priority: 'medium',
      isAiGenerated: true,
      steps: ['Expect dashboard visible', 'Click "Sign in"', 'Click "Sign out"'],
    });

    expect(updated.featureId).toBe(secondFeature.id);
    expect(updated.testType).toBe('negative');
    expect(updated.isAiGenerated).toBe(true);
    expect(updated.planningStatus).toBe('drafted');

    const steps = testCaseService.listSteps(created.id);
    expect(steps.map((step) => step.rawText)).toEqual([
      'Expect dashboard visible',
      'Click "Sign in"',
      'Click "Sign out"',
    ]);
    expect(steps.map((step) => step.stepOrder)).toEqual([1, 2, 3]);
  });

  it('preserves generated code and uses custom code when customization is enabled', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    const created = testCaseService.create({
      featureId,
      title: 'Login flow',
      steps: ['Click "Sign in"'],
    });
    const generatedBeforeCustomize = created.generatedCode;

    const customized = testCaseService.update({
      id: created.id,
      featureId,
      title: 'Login flow custom',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
      isCustomized: true,
      customCode: 'await page.goto(baseUrl);\nawait page.getByText("Custom").click();',
    });

    expect(customized.isCustomized).toBe(true);
    expect(customized.customCode).toContain('Custom');
    expect(customized.generatedCode).toBe(generatedBeforeCustomize);

    const restored = testCaseService.update({
      id: created.id,
      featureId,
      title: 'Login flow restored',
      steps: ['Expect dashboard visible'],
      isCustomized: false,
      customCode: null,
    });

    expect(restored.isCustomized).toBe(false);
    expect(restored.customCode).toBeNull();
    expect(restored.generatedCode).not.toBe(generatedBeforeCustomize);
  });

  it('updates planning status between drafted and approved', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    const created = testCaseService.create({
      featureId,
      title: 'Checkout triage flow',
      steps: ['Click "Checkout"'],
    });
    expect(created.planningStatus).toBe('drafted');

    const approved = testCaseService.update({
      id: created.id,
      featureId,
      title: created.title,
      planningStatus: 'approved',
    });
    expect(approved.planningStatus).toBe('approved');

    const movedBack = testCaseService.update({
      id: created.id,
      featureId,
      title: created.title,
      planningStatus: 'drafted',
    });
    expect(movedBack.planningStatus).toBe('drafted');
  });

  it('rejects customized code with syntax errors', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    expect(() =>
      testCaseService.create({
        featureId,
        title: 'Invalid custom code',
        steps: ['Expect success visible'],
        isCustomized: true,
        customCode:
          'await expect(page.getByText("Successfully added to cart").first()).toBeVisible({ timeout: 10000 };',
      }),
    ).toThrow(/Custom code syntax error/);
  });

  it('repairs legacy malformed expect timeout code for stored generated/custom code', () => {
    const { testCaseService, featureId, projectId } = createProjectAndFeature();

    db.prepare(
      `INSERT INTO test_cases (
         id,
         project_id,
         feature_id,
         title,
         test_type,
         priority,
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
         @isAiGenerated,
         @generatedCode,
         @customCode,
         @isCustomized,
         @createdAt,
         @updatedAt
       )`,
    ).run({
      id: 'legacy-test-1',
      projectId,
      featureId,
      title: 'Legacy malformed code',
      testType: 'positive',
      priority: 'medium',
      isAiGenerated: 0,
      generatedCode: 'await expect(page.getByText("ok").first()).toBeVisible(, { timeout: 3000 });',
      customCode: 'await expect(page.getByText("ok").first()).toBeVisible(, { timeout: 10000 });',
      isCustomized: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });

    const loaded = testCaseService.getById('legacy-test-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.generatedCode).toContain('toBeVisible({ timeout: 3000 })');
    expect(loaded?.customCode).toContain('toBeVisible({ timeout: 10000 })');
  });

  it('rolls back create when a step is invalid', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    expect(() =>
      testCaseService.create({
        featureId,
        title: 'Bad flow',
        steps: ['Do the thing now'],
      }),
    ).toThrow('Step 1: Unable to parse step');

    expect(testCaseService.listByFeature(featureId)).toHaveLength(0);
  });

  it('blocks delete when the test case has a running run', () => {
    const { testCaseService, featureId } = createProjectAndFeature();

    const testCase = testCaseService.create({
      featureId,
      title: 'Login flow',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    db.prepare(
      `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('run-test-active', testCase.id, 'chromium', 'running', testCase.createdAt, null);

    expect(() => testCaseService.delete(testCase.id)).toThrow(
      'Cannot delete test case while a run is in progress for this test case.',
    );
  });
});
