export type BrowserName = 'chromium' | 'firefox' | 'webkit';

export type ParsedAction =
  | { type: 'enter'; target: string; value: string }
  | { type: 'click'; target: string }
  | { type: 'expect'; assertion: string };

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

export interface StepResult {
  id: string;
  runId: string;
  stepId: string;
  status: StepStatus;
  errorText: string | null;
  screenshotPath: string | null;
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
