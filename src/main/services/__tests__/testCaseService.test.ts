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
});
