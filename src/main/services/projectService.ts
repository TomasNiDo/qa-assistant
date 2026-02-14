import type Database from 'better-sqlite3';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@shared/types';
import { createId } from './id';
import { nowIso } from './time';
import { safeMetadataJson, validateBaseUrl } from './validation';

export class ProjectService {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateProjectInput): Project {
    validateBaseUrl(input.baseUrl);

    const project: Project = {
      id: createId(),
      name: input.name.trim(),
      baseUrl: input.baseUrl.trim(),
      envLabel: input.envLabel?.trim() || 'local',
      metadataJson: safeMetadataJson(input.metadata),
      createdAt: nowIso(),
    };

    this.db
      .prepare(
        `INSERT INTO projects (id, name, base_url, env_label, metadata_json, created_at)
         VALUES (@id, @name, @baseUrl, @envLabel, @metadataJson, @createdAt)`,
      )
      .run(project);

    return project;
  }

  update(input: UpdateProjectInput): Project {
    validateBaseUrl(input.baseUrl);

    const existing = this.getById(input.id);
    if (!existing) {
      throw new Error('Project not found.');
    }

    const project: Project = {
      id: existing.id,
      name: input.name.trim(),
      baseUrl: input.baseUrl.trim(),
      envLabel: input.envLabel?.trim() || existing.envLabel,
      metadataJson: safeMetadataJson(input.metadata),
      createdAt: existing.createdAt,
    };

    this.db
      .prepare(
        `UPDATE projects
         SET name = @name,
             base_url = @baseUrl,
             env_label = @envLabel,
             metadata_json = @metadataJson
         WHERE id = @id`,
      )
      .run(project);

    return project;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(): Project[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, base_url, env_label, metadata_json, created_at
         FROM projects
         ORDER BY created_at DESC`,
      )
      .all() as Array<{
      id: string;
      name: string;
      base_url: string;
      env_label: string;
      metadata_json: string;
      created_at: string;
    }>;

    return rows.map(toProject);
  }

  getById(id: string): Project | null {
    const row = this.db
      .prepare(
        `SELECT id, name, base_url, env_label, metadata_json, created_at
         FROM projects
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          name: string;
          base_url: string;
          env_label: string;
          metadata_json: string;
          created_at: string;
        }
      | undefined;

    return row ? toProject(row) : null;
  }
}

function toProject(row: {
  id: string;
  name: string;
  base_url: string;
  env_label: string;
  metadata_json: string;
  created_at: string;
}): Project {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    envLabel: row.env_label,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
  };
}
