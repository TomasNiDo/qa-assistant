import type Database from 'better-sqlite3';

interface ProjectRow {
  id: string;
  name: string;
  base_url: string;
  env_label: string;
  metadata_json: string;
  created_at: string;
}

interface FeatureRow {
  id: string;
  project_id: string;
  title: string;
  acceptance_criteria: string;
  requirements: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TestCaseRow {
  id: string;
  project_id: string;
  feature_id: string;
  title: string;
  test_type: 'positive' | 'negative' | 'edge';
  priority: 'high' | 'medium' | 'low';
  planning_status: 'drafted' | 'approved';
  is_ai_generated: number;
  generated_code: string;
  custom_code: string | null;
  is_customized: number;
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

interface RunRow {
  id: string;
  test_case_id: string;
  browser: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

type Snapshot = {
  projects: ProjectRow[];
  features: FeatureRow[];
  testCases: TestCaseRow[];
  steps: StepRow[];
  runs: RunRow[];
};

class FakeDatabase {
  private projects: ProjectRow[] = [];
  private features: FeatureRow[] = [];
  private testCases: TestCaseRow[] = [];
  private steps: StepRow[] = [];
  private runs: RunRow[] = [];

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

          const deletedFeatureIds = this.features
            .filter((feature) => feature.project_id === id)
            .map((feature) => feature.id);
          this.features = this.features.filter((feature) => feature.project_id !== id);

          const deletedTestIds = this.testCases
            .filter((testCase) => testCase.project_id === id || deletedFeatureIds.includes(testCase.feature_id))
            .map((testCase) => testCase.id);
          this.testCases = this.testCases.filter(
            (testCase) => !deletedTestIds.includes(testCase.id),
          );
          this.steps = this.steps.filter((step) => !deletedTestIds.includes(step.test_case_id));
          this.runs = this.runs.filter((run) => !deletedTestIds.includes(run.test_case_id));

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

    if (normalized.includes('INSERT INTO features')) {
      return {
        run: (...args) => {
          const [feature] = args as Array<{
            id: string;
            projectId: string;
            title: string;
            acceptanceCriteria: string;
            requirements: string | null;
            notes: string | null;
            createdAt: string;
            updatedAt: string;
          }>;

          this.features.push({
            id: feature.id,
            project_id: feature.projectId,
            title: feature.title,
            acceptance_criteria: feature.acceptanceCriteria,
            requirements: feature.requirements,
            notes: feature.notes,
            created_at: feature.createdAt,
            updated_at: feature.updatedAt,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('UPDATE features')) {
      return {
        run: (...args) => {
          const [feature] = args as Array<{
            id: string;
            projectId: string;
            title: string;
            acceptanceCriteria: string;
            requirements: string | null;
            notes: string | null;
            updatedAt: string;
          }>;

          const index = this.features.findIndex((row) => row.id === feature.id);
          if (index === -1) {
            return { changes: 0 };
          }

          this.features[index] = {
            ...this.features[index],
            project_id: feature.projectId,
            title: feature.title,
            acceptance_criteria: feature.acceptanceCriteria,
            requirements: feature.requirements,
            notes: feature.notes,
            updated_at: feature.updatedAt,
          };
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('DELETE FROM features WHERE id = ?')) {
      return {
        run: (...args) => {
          const [id] = args as [string];
          const before = this.features.length;
          this.features = this.features.filter((feature) => feature.id !== id);

          const deletedTestIds = this.testCases
            .filter((testCase) => testCase.feature_id === id)
            .map((testCase) => testCase.id);
          this.testCases = this.testCases.filter((testCase) => testCase.feature_id !== id);
          this.steps = this.steps.filter((step) => !deletedTestIds.includes(step.test_case_id));
          this.runs = this.runs.filter((run) => !deletedTestIds.includes(run.test_case_id));

          return { changes: before - this.features.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM features WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [id] = args as [string];
          return this.features.find((feature) => feature.id === id);
        },
        all: () => [],
      };
    }

    if (normalized.includes('FROM features WHERE project_id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [projectId] = args as [string];
          return this.features
            .filter((feature) => feature.project_id === projectId)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        },
      };
    }

    if (normalized.includes('SELECT id, project_id FROM features WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [id] = args as [string];
          const feature = this.features.find((row) => row.id === id);
          if (!feature) {
            return undefined;
          }

          return {
            id: feature.id,
            project_id: feature.project_id,
          };
        },
        all: () => [],
      };
    }

    if (normalized.includes('INSERT INTO test_cases')) {
      return {
        run: (...args) => {
          const [testCase] = args as Array<{
            id: string;
            projectId: string;
            featureId: string;
            title: string;
            testType?: 'positive' | 'negative' | 'edge';
            priority?: 'high' | 'medium' | 'low';
            planningStatus?: 'drafted' | 'approved';
            isAiGenerated?: number | boolean;
            generatedCode?: string;
            customCode?: string | null;
            isCustomized?: number | boolean;
            createdAt: string;
            updatedAt: string;
          }>;

          this.testCases.push({
            id: testCase.id,
            project_id: testCase.projectId,
            feature_id: testCase.featureId,
            title: testCase.title,
            test_type: testCase.testType ?? 'positive',
            priority: testCase.priority ?? 'medium',
            planning_status: testCase.planningStatus ?? 'drafted',
            is_ai_generated: Number(testCase.isAiGenerated ?? 0),
            generated_code: testCase.generatedCode ?? '',
            custom_code: testCase.customCode ?? null,
            is_customized: Number(testCase.isCustomized ?? 0),
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
            featureId: string;
            title: string;
            testType: 'positive' | 'negative' | 'edge';
            priority: 'high' | 'medium' | 'low';
            planningStatus: 'drafted' | 'approved';
            isAiGenerated: number;
            generatedCode: string;
            customCode: string | null;
            isCustomized: number;
            updatedAt: string;
          }>;

          const index = this.testCases.findIndex((row) => row.id === testCase.id);
          if (index === -1) {
            return { changes: 0 };
          }

          this.testCases[index] = {
            ...this.testCases[index],
            project_id: testCase.projectId,
            feature_id: testCase.featureId,
            title: testCase.title,
            test_type: testCase.testType,
            priority: testCase.priority,
            planning_status: testCase.planningStatus,
            is_ai_generated: testCase.isAiGenerated,
            generated_code: testCase.generatedCode,
            custom_code: testCase.customCode,
            is_customized: testCase.isCustomized,
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
          this.runs = this.runs.filter((run) => run.test_case_id !== id);
          return { changes: before - this.testCases.length };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (
      normalized.includes('FROM test_cases WHERE feature_id = ?') &&
      !normalized.includes("planning_status = 'approved'")
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [featureId] = args as [string];
          return this.testCases
            .filter((testCase) => testCase.feature_id === featureId)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        },
      };
    }

    if (
      normalized.includes('FROM test_cases') &&
      normalized.includes('WHERE feature_id = ? AND planning_status = \'approved\'')
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args) => {
          const [featureId] = args as [string];
          return this.testCases
            .filter(
              (testCase) =>
                testCase.feature_id === featureId && testCase.planning_status === 'approved',
            )
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((testCase) => ({
              id: testCase.id,
              feature_id: testCase.feature_id,
              title: testCase.title,
              test_type: testCase.test_type,
              priority: testCase.priority,
            }));
        },
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

    if (normalized.includes('INSERT INTO runs')) {
      return {
        run: (...args) => {
          if (
            args.length === 1 &&
            typeof args[0] === 'object' &&
            args[0] !== null &&
            'id' in (args[0] as Record<string, unknown>)
          ) {
            const [run] = args as Array<{
              id: string;
              testCaseId: string;
              browser: string;
              status: string;
              startedAt: string;
              endedAt: string | null;
            }>;

            this.runs.push({
              id: run.id,
              test_case_id: run.testCaseId,
              browser: run.browser,
              status: run.status,
              started_at: run.startedAt,
              ended_at: run.endedAt,
            });
            return { changes: 1 };
          }

          const [id, testCaseId, browser, status, startedAt, endedAt] = args as [
            string,
            string,
            string,
            string,
            string,
            string | null,
          ];
          this.runs.push({
            id,
            test_case_id: testCaseId,
            browser,
            status,
            started_at: startedAt,
            ended_at: endedAt,
          });
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('FROM runs WHERE test_case_id = ? AND status = \'running\' LIMIT 1')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [testCaseId] = args as [string];
          const run = this.runs.find((row) => row.test_case_id === testCaseId && row.status === 'running');
          return run ? { id: run.id } : undefined;
        },
        all: () => [],
      };
    }

    if (
      normalized.includes('FROM runs') &&
      normalized.includes('test_cases.id = runs.test_case_id') &&
      normalized.includes('test_cases.project_id = ?') &&
      normalized.includes("runs.status = 'running'")
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [projectId] = args as [string];
          const testIds = this.testCases
            .filter((row) => row.project_id === projectId)
            .map((row) => row.id);
          const run = this.runs.find(
            (row) => row.status === 'running' && testIds.includes(row.test_case_id),
          );
          return run ? { id: run.id } : undefined;
        },
        all: () => [],
      };
    }

    if (
      normalized.includes('FROM runs') &&
      normalized.includes('test_cases.id = runs.test_case_id') &&
      normalized.includes('test_cases.feature_id = ?') &&
      normalized.includes("runs.status = 'running'")
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [featureId] = args as [string];
          const testIds = this.testCases
            .filter((row) => row.feature_id === featureId)
            .map((row) => row.id);
          const run = this.runs.find(
            (row) => row.status === 'running' && testIds.includes(row.test_case_id),
          );
          return run ? { id: run.id } : undefined;
        },
        all: () => [],
      };
    }

    if (
      normalized.includes('FROM runs WHERE test_case_id = ?') &&
      normalized.includes('ORDER BY started_at DESC LIMIT 1')
    ) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [testCaseId] = args as [string];
          const latestRun = this.runs
            .filter((run) => run.test_case_id === testCaseId)
            .sort((left, right) => right.started_at.localeCompare(left.started_at))[0];
          return latestRun
            ? {
                status: latestRun.status,
              }
            : undefined;
        },
        all: () => [],
      };
    }

    if (normalized.includes('FROM steps WHERE test_case_id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args) => {
          const [testCaseId] = args as [string];
          const firstStep = this.steps
            .filter((step) => step.test_case_id === testCaseId)
            .sort((a, b) => a.step_order - b.step_order)[0];
          return firstStep ? { 1: 1 } : undefined;
        },
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
      features: this.features.map((row) => ({ ...row })),
      testCases: this.testCases.map((row) => ({ ...row })),
      steps: this.steps.map((row) => ({ ...row })),
      runs: this.runs.map((row) => ({ ...row })),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.projects = snapshot.projects;
    this.features = snapshot.features;
    this.testCases = snapshot.testCases;
    this.steps = snapshot.steps;
    this.runs = snapshot.runs;
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

export function createTestDb(): Database.Database {
  return new FakeDatabase() as unknown as Database.Database;
}
