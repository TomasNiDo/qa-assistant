import type Database from 'better-sqlite3';

interface ProjectRow {
  id: string;
  name: string;
  base_url: string;
  env_label: string;
  metadata_json: string;
  created_at: string;
}

interface TestCaseRow {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  id: string;
  test_case_id: string;
  step_order: number;
  raw_text: string;
  action_json: string;
}

type Snapshot = {
  projects: ProjectRow[];
  testCases: TestCaseRow[];
  steps: StepRow[];
};

class FakeDatabase {
  private projects: ProjectRow[] = [];
  private testCases: TestCaseRow[] = [];
  private steps: StepRow[] = [];

  prepare(sql: string): {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  } {
    const normalized = normalizeSql(sql);

    if (normalized.includes('INSERT INTO projects')) {
      return {
        run: (...args) => {
          const [project] = args as Array<{
            id: string;
            name: string;
            baseUrl: string;
            envLabel: string;
            metadataJson: string;
            createdAt: string;
          }>;

          this.projects.push({
            id: project.id,
            name: project.name,
            base_url: project.baseUrl,
            env_label: project.envLabel,
            metadata_json: project.metadataJson,
            created_at: project.createdAt,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('UPDATE projects')) {
      return {
        run: (...args) => {
          const [project] = args as Array<{
            id: string;
            name: string;
            baseUrl: string;
            envLabel: string;
            metadataJson: string;
          }>;

          const index = this.projects.findIndex((row) => row.id === project.id);
          if (index === -1) {
            return { changes: 0 };
          }

          this.projects[index] = {
            ...this.projects[index],
            name: project.name,
            base_url: project.baseUrl,
            env_label: project.envLabel,
            metadata_json: project.metadataJson,
          };
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('DELETE FROM projects WHERE id = ?')) {
      return {
        run: (...args) => {
          const [id] = args as [string];
          const before = this.projects.length;
          this.projects = this.projects.filter((project) => project.id !== id);
          const remainingTestIds = this.testCases
            .filter((testCase) => testCase.project_id === id)
            .map((testCase) => testCase.id);
          this.testCases = this.testCases.filter((testCase) => testCase.project_id !== id);
          this.steps = this.steps.filter((step) => !remainingTestIds.includes(step.test_case_id));
          return { changes: before - this.projects.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM projects WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [id] = args as [string];
          return this.projects.find((project) => project.id === id);
        },
        all: () => [],
      };
    }

    if (normalized.includes('FROM projects ORDER BY created_at DESC')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [...this.projects].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    }

    if (normalized.includes('INSERT INTO test_cases')) {
      return {
        run: (...args) => {
          const [testCase] = args as Array<{
            id: string;
            projectId: string;
            title: string;
            createdAt: string;
            updatedAt: string;
          }>;

          this.testCases.push({
            id: testCase.id,
            project_id: testCase.projectId,
            title: testCase.title,
            created_at: testCase.createdAt,
            updated_at: testCase.updatedAt,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('UPDATE test_cases')) {
      return {
        run: (...args) => {
          const [testCase] = args as Array<{
            id: string;
            projectId: string;
            title: string;
            updatedAt: string;
          }>;

          const index = this.testCases.findIndex((row) => row.id === testCase.id);
          if (index === -1) {
            return { changes: 0 };
          }

          this.testCases[index] = {
            ...this.testCases[index],
            project_id: testCase.projectId,
            title: testCase.title,
            updated_at: testCase.updatedAt,
          };
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('DELETE FROM steps WHERE test_case_id = ?')) {
      return {
        run: (...args) => {
          const [testCaseId] = args as [string];
          const before = this.steps.length;
          this.steps = this.steps.filter((step) => step.test_case_id !== testCaseId);
          return { changes: before - this.steps.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('DELETE FROM test_cases WHERE id = ?')) {
      return {
        run: (...args) => {
          const [id] = args as [string];
          const before = this.testCases.length;
          this.testCases = this.testCases.filter((testCase) => testCase.id !== id);
          this.steps = this.steps.filter((step) => step.test_case_id !== id);
          return { changes: before - this.testCases.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM test_cases WHERE project_id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [projectId] = args as [string];
          return this.testCases
            .filter((testCase) => testCase.project_id === projectId)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        },
      };
    }

    if (normalized.includes('FROM test_cases WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [id] = args as [string];
          return this.testCases.find((testCase) => testCase.id === id);
        },
        all: () => [],
      };
    }

    if (normalized.includes('INSERT INTO steps')) {
      return {
        run: (...args) => {
          const [id, testCaseId, stepOrder, rawText, actionJson] = args as [
            string,
            string,
            number,
            string,
            string,
          ];

          this.steps.push({
            id,
            test_case_id: testCaseId,
            step_order: stepOrder,
            raw_text: rawText,
            action_json: actionJson,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM steps WHERE test_case_id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [testCaseId] = args as [string];
          return this.steps
            .filter((step) => step.test_case_id === testCaseId)
            .sort((a, b) => a.step_order - b.step_order);
        },
      };
    }

    throw new Error(`Unsupported SQL in FakeDatabase: ${normalized}`);
  }

  transaction<TInput>(fn: (payload: TInput) => void): (payload: TInput) => void {
    return (payload: TInput) => {
      const snapshot = this.snapshot();
      try {
        fn(payload);
      } catch (error) {
        this.restore(snapshot);
        throw error;
      }
    };
  }

  close(): void {}

  private snapshot(): Snapshot {
    return {
      projects: this.projects.map((row) => ({ ...row })),
      testCases: this.testCases.map((row) => ({ ...row })),
      steps: this.steps.map((row) => ({ ...row })),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.projects = snapshot.projects;
    this.testCases = snapshot.testCases;
    this.steps = snapshot.steps;
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export function createTestDb(): Database.Database {
  return new FakeDatabase() as unknown as Database.Database;
}
