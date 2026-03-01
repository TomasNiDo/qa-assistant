import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project, TestCase } from '@shared/types';
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

const testCasesByProject: Record<string, TestCase[]> = {
  'project-1': [
    {
      id: 'test-1',
      projectId: 'project-1',
      title: 'Checkout works',
      generatedCode: '',
      customCode: null,
      isCustomized: false,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'test-2',
      projectId: 'project-1',
      title: 'Payment failure handled',
      generatedCode: '',
      customCode: null,
      isCustomized: false,
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-20T00:00:00.000Z',
    },
    {
      id: 'test-3',
      projectId: 'project-1',
      title: 'Email notification sent',
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
    const onSelectTest = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        testCasesByProject={testCasesByProject}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId=""
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={onSelectProject}
        onSelectTest={onSelectTest}
        onBeginCreateProject={vi.fn()}
        onCreateTestForProject={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('v0.1.1-beta.2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ShopFlow' }));
    expect(onSelectProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(screen.getByRole('button', { name: 'Checkout works' }));
    expect(onSelectTest).toHaveBeenCalledWith('project-1', 'test-1');
  });

  it('supports plus and ellipsis actions per project', () => {
    const onSelectProject = vi.fn();
    const onCreateTestForProject = vi.fn();
    const onBeginEditProject = vi.fn();
    const onDeleteProject = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        testCasesByProject={testCasesByProject}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId="project-1"
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={onSelectProject}
        onSelectTest={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateTestForProject={onCreateTestForProject}
        onBeginEditProject={onBeginEditProject}
        onDeleteProject={onDeleteProject}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create test case in ShopFlow' }));
    expect(onCreateTestForProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for ShopFlow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
    expect(onBeginEditProject).toHaveBeenCalledWith('project-1');

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for ShopFlow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onDeleteProject).toHaveBeenCalledWith('project-1');

    expect(onSelectProject).toHaveBeenCalledWith('project-1');
  });

  it('keeps project action icons hidden by default until row hover/focus', () => {
    render(
      <SidebarProjectsPanel
        projects={projects}
        testCasesByProject={testCasesByProject}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId="project-1"
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectTest={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateTestForProject={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />,
    );

    expect(screen.getByTestId('project-create-test-project-1').className).toContain('opacity-0');
    expect(screen.getByTestId('project-actions-project-1').className).toContain('opacity-0');
  });

  it('renders latest run status indicators for each test case', () => {
    render(
      <SidebarProjectsPanel
        projects={projects}
        testCasesByProject={testCasesByProject}
        latestRunStatusByTestId={latestRunStatusByTestId}
        selectedProjectId="project-1"
        selectedTestId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectTest={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateTestForProject={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />,
    );

    expect(screen.getByTestId('test-status-test-1').className).toContain('bg-[#2bb673]');
    expect(screen.getByTestId('test-status-test-2').className).toContain('bg-[#d85b75]');
    expect(screen.getByTestId('test-status-test-3').className).toContain('bg-[#6f7f95]');
  });
});
