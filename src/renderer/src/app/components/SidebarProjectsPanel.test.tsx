import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Feature, Project, TestCase } from '@shared/types';
import { SidebarProjectsPanel } from './SidebarProjectsPanel';

const projects: Project[] = [
  {
    id: 'project-1',
    name: 'ShopFlow',
    baseUrl: 'https://example.com',
    envLabel: 'staging',
    metadataJson: '{}',
    createdAt: '2026-02-20T00:00:00.000Z',
  },
];

const featuresByProject: Record<string, Feature[]> = {
  'project-1': [
    {
      id: 'feature-1',
      projectId: 'project-1',
      title: 'Checkout planning',
      acceptanceCriteria: 'Checkout success path works.',
      requirements: null,
      notes: null,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
  ],
};

const testCasesByFeature: Record<string, TestCase[]> = {
  'feature-1': [
    {
      id: 'test-1',
      projectId: 'project-1',
      featureId: 'feature-1',
      title: 'Checkout works',
      testType: 'positive',
      priority: 'high',
      isAiGenerated: false,
      generatedCode: '',
      customCode: null,
      isCustomized: false,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'test-2',
      projectId: 'project-1',
      featureId: 'feature-1',
      title: 'Payment failure handled',
      testType: 'negative',
      priority: 'medium',
      isAiGenerated: true,
      generatedCode: '',
      customCode: null,
      isCustomized: false,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
  ],
};

const latestRunStatusByTestId = {
  'test-1': 'passed',
  'test-2': 'failed',
} as const;

describe('SidebarProjectsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders app version and selection callbacks', () => {
    const onSelectProject = vi.fn();
    const onSelectFeature = vi.fn();
    const onSelectTest = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        testCasesByFeature={testCasesByFeature}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId=""
        selectedFeatureId=""
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={onSelectProject}
        onSelectFeature={onSelectFeature}
        onSelectTest={onSelectTest}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={vi.fn()}
        onCreateTestForFeature={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onBeginEditFeature={vi.fn()}
        onDeleteFeature={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />, 
    );

    expect(screen.getByText('v0.1.1-beta.2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ShopFlow' }));
    expect(onSelectProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(screen.getByRole('button', { name: 'Checkout planning' }));
    expect(onSelectFeature).toHaveBeenCalledWith('project-1', 'feature-1');

    fireEvent.click(screen.getByRole('button', { name: 'Checkout works' }));
    expect(onSelectTest).toHaveBeenCalledWith('project-1', 'feature-1', 'test-1');
  });

  it('supports project and feature actions', () => {
    const onCreateFeatureForProject = vi.fn();
    const onCreateTestForFeature = vi.fn();
    const onBeginEditProject = vi.fn();
    const onDeleteProject = vi.fn();
    const onBeginEditFeature = vi.fn();
    const onDeleteFeature = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        testCasesByFeature={testCasesByFeature}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId="project-1"
        selectedFeatureId="feature-1"
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectFeature={vi.fn()}
        onSelectTest={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={onCreateFeatureForProject}
        onCreateTestForFeature={onCreateTestForFeature}
        onBeginEditProject={onBeginEditProject}
        onDeleteProject={onDeleteProject}
        onBeginEditFeature={onBeginEditFeature}
        onDeleteFeature={onDeleteFeature}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />, 
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create feature in ShopFlow' }));
    expect(onCreateFeatureForProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Create test case in feature Checkout planning' }),
    );
    expect(onCreateTestForFeature).toHaveBeenCalledWith('project-1', 'feature-1');

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for ShopFlow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
    expect(onBeginEditProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for ShopFlow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onDeleteProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Feature actions for Checkout planning' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit feature' }));
    expect(onBeginEditFeature).toHaveBeenCalledWith('feature-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Feature actions for Checkout planning' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete feature' }));
    expect(onDeleteFeature).toHaveBeenCalledWith('feature-1');
  });

  it('renders latest run status indicators for each test case', () => {
    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        testCasesByFeature={testCasesByFeature}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId="project-1"
        selectedFeatureId="feature-1"
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectFeature={vi.fn()}
        onSelectTest={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={vi.fn()}
        onCreateTestForFeature={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onBeginEditFeature={vi.fn()}
        onDeleteFeature={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />, 
    );

    expect(screen.getByTestId('test-status-test-1').className).toContain('bg-[#2bb673]');
    expect(screen.getByTestId('test-status-test-2').className).toContain('bg-[#d85b75]');
  });
});
