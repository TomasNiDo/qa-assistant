export type BrowserName = 'chromium' | 'firefox' | 'webkit';

export type ParsedAction =
  | { type: 'enter'; target: string; value: string }
  | { type: 'click'; target: string; delaySeconds?: number }
  | { type: 'navigate'; target: string }
  | { type: 'expect'; assertion: string; timeoutSeconds?: number }
  | { type: 'select'; target: string; value: string }
  | { type: 'setChecked'; target: string; checked: boolean }
  | { type: 'hover'; target: string }
  | { type: 'press'; key: string; target?: string }
  | { type: 'upload'; target: string; filePaths: string[] }
  | { type: 'dialog'; action: 'accept' | 'dismiss'; promptText?: string }
  | {
      type: 'waitForRequest';
      urlPattern: string;
      method?: string;
      status?: number;
      triggerClickTarget?: string;
      timeoutSeconds?: number;
    }
  | {
      type: 'download';
      triggerClickTarget: string;
      timeoutSeconds?: number;
    };

export type StepParseResult =
  | { ok: true; action: ParsedAction; source: 'strict' | 'fallback' }
  | { ok: false; error: string };

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'passed' | 'failed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  baseUrl: string;
  envLabel: string;
  metadataJson: string;
  createdAt: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  testCaseId: string;
  stepOrder: number;
  rawText: string;
  actionJson: string;
}

export interface Run {
  id: string;
  testCaseId: string;
  browser: BrowserName;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface ActiveRunContext {
  runId: string;
  testCaseId: string;
  projectId: string;
}

export interface StepResult {
  id: string;
  runId: string;
  stepId: string;
  stepOrder: number;
  stepRawText: string;
  status: StepStatus;
  errorText: string | null;
  screenshotPath: string | null;
}

export interface BrowserInstallState {
  browser: BrowserName;
  installed: boolean;
  installInProgress: boolean;
  executablePath: string | null;
  lastError: string | null;
}

export type BrowserInstallPhase =
  | 'idle'
  | 'starting'
  | 'downloading'
  | 'installing'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface BrowserInstallUpdate {
  browser: BrowserName;
  phase: BrowserInstallPhase;
  progress: number | null;
  message: string;
  timestamp: string;
}

export type RunUpdateEventType =
  | 'run-started'
  | 'step-started'
  | 'step-finished'
  | 'run-finished';

export interface RunUpdateEvent {
  runId: string;
  type: RunUpdateEventType;
  timestamp: string;
  runStatus?: RunStatus;
  stepId?: string;
  stepOrder?: number;
  stepStatus?: StepStatus;
  stepResult?: StepResult;
  message?: string;
}

export interface CreateProjectInput {
  name: string;
  baseUrl: string;
  envLabel?: string;
  metadata?: Record<string, string>;
}

export interface UpdateProjectInput extends CreateProjectInput {
  id: string;
}

export interface CreateTestInput {
  projectId: string;
  title: string;
  steps: string[];
}

export interface UpdateTestInput extends CreateTestInput {
  id: string;
}

export interface StartRunInput {
  testCaseId: string;
  browser: BrowserName;
}

export interface GenerateStepsInput {
  title: string;
  baseUrl: string;
  metadataJson?: string;
}

export interface GenerateBugReportInput {
  runId: string;
}

export interface AppConfig {
  defaultBrowser: BrowserName;
  stepTimeoutSeconds: number;
  continueOnFailure: boolean;
  enableSampleProjectSeed: boolean;
}

export interface ApiError {
  message: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface GeneratedStep {
  rawText: string;
  reason: string;
  isDestructive?: boolean;
}

export interface GeneratedBugReport {
  title: string;
  environment: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  evidence: string[];
}

export interface SampleSeedResult {
  project: Project;
  testCase: TestCase;
  createdProject: boolean;
  createdTestCase: boolean;
}
