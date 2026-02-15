import type { Dispatch, SetStateAction } from 'react';
import type { ProjectFormState } from '../types';
import { fieldClass, panelClass, primaryButtonClass } from '../uiClasses';

interface ProjectSetupScreenProps {
  projectForm: ProjectFormState;
  setProjectForm: Dispatch<SetStateAction<ProjectFormState>>;
  projectNameError: string | null;
  projectBaseUrlError: string | null;
  canSaveProject: boolean;
  onCreateProject: () => void;
}

export function ProjectSetupScreen({
  projectForm,
  setProjectForm,
  projectNameError,
  projectBaseUrlError,
  canSaveProject,
  onCreateProject,
}: ProjectSetupScreenProps): JSX.Element {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className={panelClass}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/75">Step 2</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Set up first project</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Create one project to unlock the main testing workspace.
            </p>
          </div>
          <span className="inline-flex h-8 items-center rounded-full border border-warning/60 bg-warning/15 px-3 text-xs font-bold tracking-wide text-warning-foreground">
            Required
          </span>
        </div>

        <div className="space-y-3.5">
          <h3 className="text-sm font-bold tracking-wide text-foreground">Create project</h3>

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
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onCreateProject}
              disabled={!canSaveProject}
            >
              Create project
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
