import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { FeatureService } from '../featureService';
import { ProjectService } from '../projectService';
import { TestCaseService } from '../testCaseService';
import { createTestDb } from './testDb';

describe('FeatureService', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  function createProject(): { projectId: string; projectCreatedAt: string } {
    const projects = new ProjectService(db);
    const project = projects.create({
      name: 'Checkout',
      baseUrl: 'https://example.com',
    });

    return {
      projectId: project.id,
      projectCreatedAt: project.createdAt,
    };
  }

  it('creates and lists features; duplicate titles are allowed per project', () => {
    db = createTestDb();
    const service = new FeatureService(db);
    const { projectId } = createProject();

    const first = service.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout succeeds for valid card.',
      requirements: null,
      notes: null,
    });
    const second = service.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout fails for invalid card.',
      requirements: 'Cover negative case',
      notes: 'Same title intentionally',
    });

    expect(first.id).not.toBe(second.id);
    expect(service.list(projectId)).toHaveLength(2);
  });

  it('rejects missing title or acceptance criteria', () => {
    db = createTestDb();
    const service = new FeatureService(db);
    const { projectId } = createProject();

    expect(() =>
      service.create({
        projectId,
        title: '   ',
        acceptanceCriteria: 'Valid',
      }),
    ).toThrow('Feature title is required.');

    expect(() =>
      service.create({
        projectId,
        title: 'Checkout planning',
        acceptanceCriteria: '   ',
      }),
    ).toThrow('Acceptance criteria is required.');
  });

  it('updates an existing feature and preserves immutable fields', () => {
    db = createTestDb();
    const service = new FeatureService(db);
    const { projectId } = createProject();

    const created = service.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout succeeds.',
    });

    const updated = service.update({
      id: created.id,
      projectId,
      title: 'Checkout planning v2',
      acceptanceCriteria: 'Checkout succeeds and creates order.',
      requirements: 'Track order id',
      notes: 'Expanded scope',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.title).toBe('Checkout planning v2');
    expect(updated.acceptanceCriteria).toContain('creates order');
    expect(updated.requirements).toBe('Track order id');
  });

  it('blocks delete during active run', () => {
    db = createTestDb();
    const service = new FeatureService(db);
    const tests = new TestCaseService(db);
    const { projectId, projectCreatedAt } = createProject();

    const feature = service.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout succeeds.',
    });

    const testCase = tests.create({
      featureId: feature.id,
      title: 'Checkout flow',
      steps: ['Click "Checkout"'],
    });

    db.prepare(
      `INSERT INTO runs (id, test_case_id, browser, status, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('run-feature-active', testCase.id, 'chromium', 'running', projectCreatedAt, null);

    expect(() => service.delete(feature.id)).toThrow(
      'Cannot delete feature while a run is in progress for this feature.',
    );
  });

  it('cascades child tests on delete', () => {
    db = createTestDb();
    const service = new FeatureService(db);
    const tests = new TestCaseService(db);
    const { projectId } = createProject();

    const feature = service.create({
      projectId,
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout succeeds.',
    });

    const testCase = tests.create({
      featureId: feature.id,
      title: 'Checkout flow',
      steps: ['Click "Checkout"'],
    });

    expect(service.delete(feature.id)).toBe(true);
    expect(service.delete(feature.id)).toBe(false);
    expect(tests.getById(testCase.id)).toBeNull();
  });
});
