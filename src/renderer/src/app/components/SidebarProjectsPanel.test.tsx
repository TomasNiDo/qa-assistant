import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Feature, Project } from '@shared/types';
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

describe('SidebarProjectsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders app version and selection callbacks', () => {
    const onSelectProject = vi.fn();
    const onSelectFeature = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        selectedProjectId=""
        selectedFeatureId=""
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={onSelectProject}
        onSelectFeature={onSelectFeature}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={vi.fn()}
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

    expect(screen.queryByText('Checkout works')).toBeNull();
  });

  it('supports project and feature actions', () => {
    const onCreateFeatureForProject = vi.fn();
    const onBeginEditProject = vi.fn();
    const onDeleteProject = vi.fn();
    const onBeginEditFeature = vi.fn();
    const onDeleteFeature = vi.fn();

    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        selectedProjectId="project-1"
        selectedFeatureId="feature-1"
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectFeature={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={onCreateFeatureForProject}
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

  it('does not render sidebar test case shortcuts', () => {
    render(
      <SidebarProjectsPanel
        projects={projects}
        featuresByProject={featuresByProject}
        selectedProjectId="project-1"
        selectedFeatureId="feature-1"
        appVersion="0.1.1-beta.2"
        isProjectDeleteBlocked={() => false}
        onSelectProject={vi.fn()}
        onSelectFeature={vi.fn()}
        onBeginCreateProject={vi.fn()}
        onCreateFeatureForProject={vi.fn()}
        onBeginEditProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onBeginEditFeature={vi.fn()}
        onDeleteFeature={vi.fn()}
        onOpenStepDocs={vi.fn()}
        onOpenBrowserInstall={vi.fn()}
      />, 
    );

    expect(screen.queryByRole('button', { name: /Create test case in feature/i })).toBeNull();
  });
});
