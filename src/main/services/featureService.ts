import type Database from 'better-sqlite3';
import type {
  CreateFeatureInput,
  Feature,
  UpdateFeatureInput,
} from '@shared/types';
import { createId } from './id';
import { nowIso } from './time';

export class FeatureService {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateFeatureInput): Feature {
    const timestamp = nowIso();
    const title = requireNonEmpty(input.title, 'Feature title is required.');
    const acceptanceCriteria = requireNonEmpty(
      input.acceptanceCriteria,
      'Acceptance criteria is required.',
    );
    const feature: Feature = {
      id: createId(),
      projectId: input.projectId,
      title,
      acceptanceCriteria,
      requirements: normalizeOptionalText(input.requirements),
      notes: normalizeOptionalText(input.notes),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.db
      .prepare(
        `INSERT INTO features (
           id,
           project_id,
           title,
           acceptance_criteria,
           requirements,
           notes,
           created_at,
           updated_at
         )
         VALUES (
           @id,
           @projectId,
           @title,
           @acceptanceCriteria,
           @requirements,
           @notes,
           @createdAt,
           @updatedAt
         )`,
      )
      .run(feature);

    return feature;
  }

  update(input: UpdateFeatureInput): Feature {
    const existing = this.getById(input.id);
    if (!existing) {
      throw new Error('Feature not found.');
    }

    const updated: Feature = {
      id: existing.id,
      projectId: input.projectId,
      title: requireNonEmpty(input.title, 'Feature title is required.'),
      acceptanceCriteria: requireNonEmpty(
        input.acceptanceCriteria,
        'Acceptance criteria is required.',
      ),
      requirements: normalizeOptionalText(input.requirements),
      notes: normalizeOptionalText(input.notes),
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    this.db
      .prepare(
        `UPDATE features
         SET project_id = @projectId,
             title = @title,
             acceptance_criteria = @acceptanceCriteria,
             requirements = @requirements,
             notes = @notes,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(updated);

    return updated;
  }

  delete(id: string): boolean {
    const running = this.db
      .prepare(
        `SELECT runs.id
         FROM runs
         JOIN test_cases ON test_cases.id = runs.test_case_id
         WHERE test_cases.feature_id = ? AND runs.status = 'running'
         LIMIT 1`,
      )
      .get(id) as { id: string } | undefined;
    if (running) {
      throw new Error('Cannot delete feature while a run is in progress for this feature.');
    }

    const result = this.db.prepare('DELETE FROM features WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(projectId: string): Feature[] {
    const rows = this.db
      .prepare(
        `SELECT id,
                project_id,
                title,
                acceptance_criteria,
                requirements,
                notes,
                created_at,
                updated_at
         FROM features
         WHERE project_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(projectId) as Array<{
      id: string;
      project_id: string;
      title: string;
      acceptance_criteria: string;
      requirements: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map(toFeature);
  }

  getById(id: string): Feature | null {
    const row = this.db
      .prepare(
        `SELECT id,
                project_id,
                title,
                acceptance_criteria,
                requirements,
                notes,
                created_at,
                updated_at
         FROM features
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          project_id: string;
          title: string;
          acceptance_criteria: string;
          requirements: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    return row ? toFeature(row) : null;
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireNonEmpty(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(message);
  }

  return trimmed;
}

function toFeature(row: {
  id: string;
  project_id: string;
  title: string;
  acceptance_criteria: string;
  requirements: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): Feature {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    acceptanceCriteria: row.acceptance_criteria,
    requirements: row.requirements,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
