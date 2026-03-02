import type {
  CreateFeatureInput,
  CreateProjectInput,
  CreateTestInput,
  SampleSeedResult,
} from '@shared/types';
import { FeatureService } from './featureService';
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

const SAMPLE_FEATURE: Omit<CreateFeatureInput, 'projectId'> = {
  title: 'Sample Login Feature',
  acceptanceCriteria:
    'A user with valid credentials can sign in and see the dashboard.',
  requirements: 'Use the seeded sample credentials and verify dashboard visibility.',
  notes: 'Auto-created by sample seed.',
};

const SAMPLE_TEST: Omit<CreateTestInput, 'featureId'> = {
  title: 'Sample login flow',
  testType: 'positive',
  priority: 'high',
  isAiGenerated: false,
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
    private readonly featureService: FeatureService,
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
    const existingFeature = this.featureService
      .list(project.id)
      .find((feature) => feature.title === SAMPLE_FEATURE.title);
    const feature =
      existingFeature ??
      this.featureService.create({
        projectId: project.id,
        ...SAMPLE_FEATURE,
      });

    const existingTestCase = this.testCaseService
      .listByFeature(feature.id)
      .find((testCase) => testCase.title === SAMPLE_TEST.title);
    const testCase =
      existingTestCase ??
      this.testCaseService.create({
        featureId: feature.id,
        ...SAMPLE_TEST,
      });

    return {
      project,
      feature,
      testCase,
      createdProject: !existingProject,
      createdFeature: !existingFeature,
      createdTestCase: !existingTestCase,
    };
  }
}
