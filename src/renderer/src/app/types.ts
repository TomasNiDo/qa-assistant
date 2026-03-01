import type { BrowserInstallPhase } from '@shared/types';

export interface ProjectFormState {
  id: string;
  name: string;
  baseUrl: string;
  envLabel: string;
}

export interface FeatureFormState {
  id: string;
  title: string;
  acceptanceCriteria: string;
  requirements: string;
  notes: string;
}

export interface TestFormState {
  id: string;
  title: string;
  testType: 'positive' | 'negative' | 'edge';
  priority: 'high' | 'medium' | 'low';
  isAiGenerated: boolean;
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
  testType: 'positive',
  priority: 'medium',
  isAiGenerated: false,
};

export const DEFAULT_FEATURE_FORM: FeatureFormState = {
  id: '',
  title: '',
  acceptanceCriteria: '',
  requirements: '',
  notes: '',
};

export type ThemeMode = 'light' | 'dark';
