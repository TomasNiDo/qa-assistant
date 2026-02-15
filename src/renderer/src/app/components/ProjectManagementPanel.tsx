import type { Dispatch, SetStateAction } from 'react';
import type { Project } from '@shared/types';
import type { ProjectFormMode, ProjectFormState } from '../types';
import {
  dangerButtonClass,
  fieldClass,
  mutedButtonClass,
  panelClass,
  primaryButtonClass,
} from '../uiClasses';

interface ProjectManagementPanelProps {
  selectedProject: Project | null;
  selectedProjectName: string;
  projectForm: ProjectFormState;
  setProjectForm: Dispatch<SetStateAction<ProjectFormState>>;
  projectFormMode: ProjectFormMode;
  isProjectFormOpen: boolean;
  projectNameError: string | null;
  projectBaseUrlError: string | null;
  canSaveProject: boolean;
  isSelectedProjectDeleteBlocked: boolean;
  onCreateProject: () => void;
  onUpdateSelectedProject: () => void;
  onCloseProjectForm: () => void;
  onBeginEditSelectedProject: () => void;
  onDeleteSelectedProject: () => void;
}

export function ProjectManagementPanel({
  selectedProject,
  selectedProjectName,
  projectForm,
  setProjectForm,
  projectFormMode,
  isProjectFormOpen,
  projectNameError,
  projectBaseUrlError,
  canSaveProject,
  isSelectedProjectDeleteBlocked,
  onCreateProject,
  onUpdateSelectedProject,
  onCloseProjectForm,
  onBeginEditSelectedProject,
  onDeleteSelectedProject,
}: ProjectManagementPanelProps): JSX.Element {
  return (
    <section className={panelClass}>
      {isProjectFormOpen ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold tracking-wide text-foreground">
            {projectFormMode === 'create' ? 'Create project' : 'Edit project'}
          </h3>

          <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Name
            <input
              className={fieldClass}
              value={projectForm.name}
              onChange={(event) => setProjectForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            {projectNameError ? <span className="text-xs text-danger">{projectNameError}</span> : null}
          </label>

          <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Base URL
            <input
              className={fieldClass}
              value={projectForm.baseUrl}
              onChange={(event) =>
                setProjectForm((previous) => ({ ...previous, baseUrl: event.target.value }))
              }
            />
            {projectBaseUrlError ? (
              <span className="text-xs text-danger">{projectBaseUrlError}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Include protocol (https://...)</span>
            )}
          </label>

          <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Environment
            <input
              className={fieldClass}
              value={projectForm.envLabel}
              onChange={(event) => setProjectForm((previous) => ({ ...previous, envLabel: event.target.value }))}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {projectFormMode === 'create' ? (
              <button type="button" className={primaryButtonClass} onClick={onCreateProject} disabled={!canSaveProject}>
                Create project
              </button>
            ) : (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={onUpdateSelectedProject}
                disabled={!selectedProject || !canSaveProject}
              >
                Save changes
              </button>
            )}
            <button type="button" className={mutedButtonClass} onClick={onCloseProjectForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold tracking-wide text-foreground">Project actions</h3>
          <p className="text-xs text-muted-foreground">
            Selected project: <span className="font-medium text-foreground">{selectedProjectName}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={mutedButtonClass}
              onClick={onBeginEditSelectedProject}
              disabled={!selectedProject}
            >
              Edit selected
            </button>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={onDeleteSelectedProject}
              disabled={!selectedProject || isSelectedProjectDeleteBlocked}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
