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
};

export type ThemeMode = 'light' | 'dark';
