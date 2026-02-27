import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { ProjectService } from '../projectService';
import { TestCaseService } from '../testCaseService';
import { createTestDb } from './testDb';

describe('TestCaseService', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('creates test cases and persists parsed steps in order', () => {
    db = createTestDb();
    const projects = new ProjectService(db);
    const tests = new TestCaseService(db);
    const project = projects.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });

    const created = tests.create({
      projectId: project.id,
      title: 'Login flow',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    expect(created.title).toBe('Login flow');
    expect(created.generatedCode).toContain('await page.getByRole("button", { name: "Sign in" }).first().click();');
    expect(created.customCode).toBeNull();
    expect(created.isCustomized).toBe(false);
    expect(tests.list(project.id)).toHaveLength(1);

    const steps = tests.listSteps(created.id);
    expect(steps.map((step) => step.stepOrder)).toEqual([1, 2]);
    expect(JSON.parse(steps[0].actionJson)).toEqual({ type: 'click', target: 'Sign in' });
    expect(JSON.parse(steps[1].actionJson)).toEqual({
      type: 'expect',
      assertion: 'dashboard visible',
    });
  });

  it('updates test case metadata and step ordering', () => {
    db = createTestDb();
    const projects = new ProjectService(db);
    const tests = new TestCaseService(db);
    const project = projects.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });

    const created = tests.create({
      projectId: project.id,
      title: 'Login flow',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    const updated = tests.update({
      id: created.id,
      projectId: project.id,
      title: 'Updated login flow',
      steps: ['Expect dashboard visible', 'Click "Sign in"', 'Click "Sign out"'],
    });

    expect(updated.title).toBe('Updated login flow');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );

    const steps = tests.listSteps(created.id);
    expect(steps.map((step) => step.rawText)).toEqual([
      'Expect dashboard visible',
      'Click "Sign in"',
      'Click "Sign out"',
    ]);
    expect(steps.map((step) => step.stepOrder)).toEqual([1, 2, 3]);
  });

  it('preserves generated code and uses custom code when customization is enabled', () => {
    db = createTestDb();
    const projects = new ProjectService(db);
    const tests = new TestCaseService(db);
    const project = projects.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });

    const created = tests.create({
      projectId: project.id,
      title: 'Login flow',
      steps: ['Click "Sign in"'],
    });
    const generatedBeforeCustomize = created.generatedCode;

    const customized = tests.update({
      id: created.id,
      projectId: project.id,
      title: 'Login flow custom',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
      isCustomized: true,
      customCode: 'await page.goto(baseUrl);\nawait page.getByText("Custom").click();',
    });

    expect(customized.isCustomized).toBe(true);
    expect(customized.customCode).toContain('Custom');
    expect(customized.generatedCode).toBe(generatedBeforeCustomize);

    const restored = tests.update({
      id: created.id,
      projectId: project.id,
      title: 'Login flow restored',
      steps: ['Expect dashboard visible'],
      isCustomized: false,
      customCode: null,
    });

    expect(restored.isCustomized).toBe(false);
    expect(restored.customCode).toBeNull();
    expect(restored.generatedCode).not.toBe(generatedBeforeCustomize);
    expect(restored.generatedCode).toContain('await expect(page.getByText("dashboard visible").first()).toBeVisible();');
  });

  it('rolls back create when a step is invalid', () => {
    db = createTestDb();
    const projects = new ProjectService(db);
    const tests = new TestCaseService(db);
    const project = projects.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });

    expect(() =>
      tests.create({
        projectId: project.id,
        title: 'Bad flow',
        steps: ['Do the thing now'],
      }),
    ).toThrow('Step 1: Unable to parse step');

    expect(tests.list(project.id)).toHaveLength(0);
  });

  it('blocks delete when the test case has a running run', () => {
    db = createTestDb();
    const projects = new ProjectService(db);
    const tests = new TestCaseService(db);
    const project = projects.create({
      name: 'Auth',
      baseUrl: 'https://example.com',
    });
    const testCase = tests.create({
      projectId: project.id,
      title: 'Login flow',
      steps: ['Click "Sign in"', 'Expect dashboard visible'],
    });

    db.prepare(
      `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('run-test-active', testCase.id, 'chromium', 'running', testCase.createdAt, null);

    expect(() => tests.delete(testCase.id)).toThrow(
      'Cannot delete test case while a run is in progress for this test case.',
    );
  });
});
