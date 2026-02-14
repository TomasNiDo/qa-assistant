import type { CreateProjectInput, CreateTestInput, SampleSeedResult } from '@shared/types';
import { ProjectService } from './projectService';
import { TestCaseService } from './testCaseService';

const SAMPLE_PROJECT: CreateProjectInput = {
  name: 'Sample QA Project',
  baseUrl: 'https://example.com',
  envLabel: 'sample',
  metadata: {
    seedTag: 'sample-local',
  },
};

const SAMPLE_TEST: Omit<CreateTestInput, 'projectId'> = {
  title: 'Sample login flow',
  steps: [
    'Enter "qa.user@example.com" in "Email" field',
    'Enter "password123" in "Password" field',
    'Click "Login"',
    'Expect dashboard is visible',
  ],
};

export class SampleSeedService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly testCaseService: TestCaseService,
  ) {}

  seedSampleProject(): SampleSeedResult {
    const existingProject = this.projectService
      .list()
      .find(
        (project) =>
          project.name === SAMPLE_PROJECT.name &&
          project.baseUrl === SAMPLE_PROJECT.baseUrl &&
          project.envLabel === SAMPLE_PROJECT.envLabel,
      );

    const project = existingProject ?? this.projectService.create(SAMPLE_PROJECT);
    const existingTestCase = this.testCaseService
      .list(project.id)
      .find((testCase) => testCase.title === SAMPLE_TEST.title);
    const testCase =
      existingTestCase ??
      this.testCaseService.create({
        projectId: project.id,
        ...SAMPLE_TEST,
      });

    return {
      project,
      testCase,
      createdProject: !existingProject,
      createdTestCase: !existingTestCase,
    };
  }
}

