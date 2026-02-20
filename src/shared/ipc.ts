import type {
  ApiResult,
  AppConfig,
  BrowserInstallUpdate,
  BrowserInstallState,
  ActiveRunContext,
  CreateProjectInput,
  CreateTestInput,
  GenerateBugReportInput,
  GenerateStepsInput,
  GeneratedBugReport,
  GeneratedStep,
  Project,
  Run,
  RunUpdateEvent,
  SampleSeedResult,
  StartRunInput,
  Step,
  StepParseResult,
  StepResult,
  TestCase,
  UpdateProjectInput,
  UpdateTestInput,
} from './types';

export const IPC_CHANNELS = {
  healthPing: 'app.healthPing',
  configGet: 'app.configGet',
  configSet: 'app.configSet',
  seedSampleProject: 'seed.sampleProject',
  projectCreate: 'project.create',
  projectUpdate: 'project.update',
  projectDelete: 'project.delete',
  projectList: 'project.list',
  testCreate: 'test.create',
  testUpdate: 'test.update',
  testDelete: 'test.delete',
  testList: 'test.list',
  stepList: 'step.list',
  stepParse: 'step.parse',
  runStart: 'run.start',
  runCancel: 'run.cancel',
  runStatus: 'run.status',
  runActiveContext: 'run.activeContext',
  runHistory: 'run.history',
  stepResults: 'run.stepResults',
  runGetScreenshotDataUrl: 'run.getScreenshotDataUrl',
  runGetScreenshotThumbnailDataUrl: 'run.getScreenshotThumbnailDataUrl',
  runBrowserStatus: 'run.browserStatus',
  runInstallBrowser: 'run.installBrowser',
  openStepDocs: 'docs.openStepDocs',
  runUpdate: 'run.update',
  runBrowserInstallUpdate: 'run.browserInstallUpdate',
  aiGenerateSteps: 'ai.generateSteps',
  aiGenerateBugReport: 'ai.generateBugReport',
} as const;

export interface QaAssistantApi {
  healthPing: () => Promise<ApiResult<string>>;
  configGet: () => Promise<ApiResult<AppConfig>>;
  configSet: (input: AppConfig) => Promise<ApiResult<AppConfig>>;
  seedSampleProject: () => Promise<ApiResult<SampleSeedResult>>;

  projectCreate: (input: CreateProjectInput) => Promise<ApiResult<Project>>;
  projectUpdate: (input: UpdateProjectInput) => Promise<ApiResult<Project>>;
  projectDelete: (id: string) => Promise<ApiResult<boolean>>;
  projectList: () => Promise<ApiResult<Project[]>>;

  testCreate: (input: CreateTestInput) => Promise<ApiResult<TestCase>>;
  testUpdate: (input: UpdateTestInput) => Promise<ApiResult<TestCase>>;
  testDelete: (id: string) => Promise<ApiResult<boolean>>;
  testList: (projectId: string) => Promise<ApiResult<TestCase[]>>;
  stepList: (testCaseId: string) => Promise<ApiResult<Step[]>>;
  stepParse: (rawText: string) => Promise<ApiResult<StepParseResult>>;

  runStart: (input: StartRunInput) => Promise<ApiResult<Run>>;
  runCancel: (runId: string) => Promise<ApiResult<boolean>>;
  runStatus: (runId: string) => Promise<ApiResult<Run | null>>;
  runActiveContext: () => Promise<ApiResult<ActiveRunContext | null>>;
  runHistory: (testCaseId: string) => Promise<ApiResult<Run[]>>;
  stepResults: (runId: string) => Promise<ApiResult<StepResult[]>>;
  runGetScreenshotDataUrl: (screenshotPath: string) => Promise<ApiResult<string>>;
  runGetScreenshotThumbnailDataUrl: (screenshotPath: string) => Promise<ApiResult<string>>;
  runBrowserStatus: () => Promise<ApiResult<BrowserInstallState[]>>;
  runInstallBrowser: (browser: Run['browser']) => Promise<ApiResult<BrowserInstallState>>;
  openStepDocs: () => Promise<ApiResult<boolean>>;
  onRunUpdate: (listener: (event: RunUpdateEvent) => void) => () => void;
  onBrowserInstallUpdate: (listener: (event: BrowserInstallUpdate) => void) => () => void;

  aiGenerateSteps: (input: GenerateStepsInput) => Promise<ApiResult<GeneratedStep[]>>;
  aiGenerateBugReport: (input: GenerateBugReportInput) => Promise<ApiResult<GeneratedBugReport>>;
}
