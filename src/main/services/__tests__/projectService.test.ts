import { afterEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { ProjectService } from '../projectService';
import { createTestDb } from './testDb';

describe('ProjectService', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('creates and lists projects with normalized data', () => {
    db = createTestDb();
    const service = new ProjectService(db);

    const created = service.create({
      name: ' Checkout ',
      baseUrl: 'https://example.com',
      metadata: { team: 'qa' },
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Checkout');
    expect(created.envLabel).toBe('local');
    expect(created.metadataJson).toBe('{"team":"qa"}');

    expect(service.list()).toHaveLength(1);
    expect(service.getById(created.id)).toEqual(created);
  });

  it('updates an existing project and keeps immutable fields', () => {
    db = createTestDb();
    const service = new ProjectService(db);
    const created = service.create({
      name: 'Checkout',
      baseUrl: 'https://example.com',
      envLabel: 'staging',
      metadata: { owner: 'qa' },
    });

    const updated = service.update({
      id: created.id,
      name: 'Checkout Flow',
      baseUrl: 'https://staging.example.com',
      envLabel: 'staging-2',
      metadata: { owner: 'automation' },
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.name).toBe('Checkout Flow');
    expect(updated.baseUrl).toBe('https://staging.example.com');
    expect(updated.envLabel).toBe('staging-2');
    expect(updated.metadataJson).toBe('{"owner":"automation"}');
  });

  it('validates base URL and supports delete', () => {
    db = createTestDb();
    const service = new ProjectService(db);

    expect(() =>
      service.create({
        name: 'Invalid',
        baseUrl: 'example.com',
      }),
    ).toThrow('Base URL must be a valid URL including protocol');

    const created = service.create({
      name: 'Valid',
      baseUrl: 'https://example.com',
    });

    expect(service.delete(created.id)).toBe(true);
    expect(service.delete(created.id)).toBe(false);
  });
});
