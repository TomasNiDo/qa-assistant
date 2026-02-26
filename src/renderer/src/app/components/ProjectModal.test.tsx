import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectModal } from './ProjectModal';

describe('ProjectModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders create mode and calls create handler', () => {
    const onCreateProject = vi.fn();

    render(
      <ProjectModal
        projectForm={{ id: '', name: 'Project A', baseUrl: 'https://example.com', envLabel: 'staging' }}
        setProjectForm={vi.fn()}
        projectFormMode="create"
        projectNameError={null}
        projectBaseUrlError={null}
        canSaveProject
        onClose={vi.fn()}
        onCreateProject={onCreateProject}
        onUpdateProject={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it('disables submit button when form is invalid', () => {
    render(
      <ProjectModal
        projectForm={{ id: '', name: '', baseUrl: '', envLabel: 'staging' }}
        setProjectForm={vi.fn()}
        projectFormMode="create"
        projectNameError="Project name is required."
        projectBaseUrlError="Base URL is required."
        canSaveProject={false}
        onClose={vi.fn()}
        onCreateProject={vi.fn()}
        onUpdateProject={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Create Project' }).hasAttribute('disabled')).toBe(true);
  });
});
