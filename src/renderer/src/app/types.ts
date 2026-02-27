import type { BrowserInstallPhase } from '@shared/types';

export interface ProjectFormState {
  id: string;
  name: string;
  baseUrl: string;
  envLabel: string;
}

export interface TestFormState {
  id: string;
  title: string;
  stepsText: string;
  generatedCode: string;
  customCode: string;
  isCustomized: boolean;
  isCodeEditingEnabled: boolean;
  activeView: 'steps' | 'code';
}

export interface BrowserInstallProgressState {
  phase: BrowserInstallPhase;
  progress: number | null;
  message: string;
  timestamp: string;
}

export type ProjectFormMode = 'create' | 'edit';

export const DEFAULT_PROJECT_FORM: ProjectFormState = {
  id: '',
  name: 'New Project',
  baseUrl: 'https://example.com',
  envLabel: 'local',
};

export const DEFAULT_TEST_FORM: TestFormState = {
  id: '',
  title: '',
  stepsText: 'Click "Login"',
  generatedCode: '',
  customCode: '',
  isCustomized: false,
  isCodeEditingEnabled: false,
  activeView: 'steps',
};

export type ThemeMode = 'light' | 'dark';
