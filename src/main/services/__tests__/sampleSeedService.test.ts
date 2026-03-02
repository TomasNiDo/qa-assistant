import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { FeatureService } from '../featureService';
import { ProjectService } from '../projectService';
import { SampleSeedService } from '../sampleSeedService';
import { TestCaseService } from '../testCaseService';
import { createTestDb } from './testDb';

describe('SampleSeedService', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('creates sample project and sample test on first seed', () => {
    db = createTestDb();
    const projectService = new ProjectService(db);
    const featureService = new FeatureService(db);
    const testCaseService = new TestCaseService(db);
    const seedService = new SampleSeedService(projectService, featureService, testCaseService);

    const result = seedService.seedSampleProject();

    expect(result.createdProject).toBe(true);
    expect(result.createdFeature).toBe(true);
    expect(result.createdTestCase).toBe(true);
    expect(result.project.name).toBe('Sample QA Project');
    expect(result.feature.title).toBe('Sample Login Feature');
    expect(result.testCase.title).toBe('Sample login flow');
    expect(testCaseService.listSteps(result.testCase.id)).toHaveLength(4);
  });

  it('is idempotent when called repeatedly', () => {
    db = createTestDb();
    const projectService = new ProjectService(db);
    const featureService = new FeatureService(db);
    const testCaseService = new TestCaseService(db);
    const seedService = new SampleSeedService(projectService, featureService, testCaseService);

    const first = seedService.seedSampleProject();
    const second = seedService.seedSampleProject();

    expect(first.project.id).toBe(second.project.id);
    expect(first.feature.id).toBe(second.feature.id);
    expect(first.testCase.id).toBe(second.testCase.id);
    expect(second.createdProject).toBe(false);
    expect(second.createdFeature).toBe(false);
    expect(second.createdTestCase).toBe(false);
  });
});
