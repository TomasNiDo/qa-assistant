import type { Dispatch, SetStateAction } from 'react';
import type { ProjectFormMode, ProjectFormState } from '../types';
import { fieldClass, mutedButtonClass, primaryButtonClass } from '../uiClasses';
import { ModalShell } from './ModalShell';

interface ProjectModalProps {
  projectForm: ProjectFormState;
  setProjectForm: Dispatch<SetStateAction<ProjectFormState>>;
  projectFormMode: ProjectFormMode;
  projectNameError: string | null;
  projectBaseUrlError: string | null;
  canSaveProject: boolean;
  onClose: () => void;
  onCreateProject: () => void;
  onUpdateProject: () => void;
}

export function ProjectModal({
  projectForm,
  setProjectForm,
  projectFormMode,
  projectNameError,
  projectBaseUrlError,
  canSaveProject,
  onClose,
  onCreateProject,
  onUpdateProject,
}: ProjectModalProps): JSX.Element {
  const isCreate = projectFormMode === 'create';

  return (
    <ModalShell title={isCreate ? 'Add Project' : 'Edit Project'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Project Name
          <input
            className={fieldClass}
            value={projectForm.name}
            onChange={(event) => setProjectForm((previous) => ({ ...previous, name: event.target.value }))}
          />
          {projectNameError ? <span className="text-[11px] text-danger">{projectNameError}</span> : null}
        </label>

        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          URL
          <input
            className={fieldClass}
            value={projectForm.baseUrl}
            onChange={(event) =>
              setProjectForm((previous) => ({ ...previous, baseUrl: event.target.value }))
            }
          />
          {projectBaseUrlError ? (
            <span className="text-[11px] text-danger">{projectBaseUrlError}</span>
          ) : null}
        </label>

        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Environment
          <input
            className={fieldClass}
            value={projectForm.envLabel}
            onChange={(event) => setProjectForm((previous) => ({ ...previous, envLabel: event.target.value }))}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={mutedButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={isCreate ? onCreateProject : onUpdateProject}
            disabled={!canSaveProject}
          >
            {isCreate ? 'Create Project' : 'Save Project'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

