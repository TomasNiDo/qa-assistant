import type { Project, TestCase } from '@shared/types';
import { panelClass, primaryButtonClass } from '../uiClasses';

interface SidebarProjectsPanelProps {
  projects: Project[];
  testCasesByProject: Record<string, TestCase[]>;
  selectedProjectId: string;
  selectedTestId: string;
  onSelectProject: (projectId: string) => void;
  onSelectTest: (projectId: string, testId: string) => void;
  onBeginCreateProject: () => void;
}

export function SidebarProjectsPanel({
  projects,
  testCasesByProject,
  selectedProjectId,
  selectedTestId,
  onSelectProject,
  onSelectTest,
  onBeginCreateProject,
}: SidebarProjectsPanelProps): JSX.Element {
  return (
    <section className={panelClass}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-wide text-foreground">Projects & tests</h2>
        <button type="button" className={primaryButtonClass} onClick={onBeginCreateProject}>
          New Project
        </button>
      </div>

      <ul className="space-y-2">
        {projects.map((project) => {
          const projectTests = testCasesByProject[project.id] ?? [];

          return (
            <li key={project.id} className="space-y-1.5">
              <button
                type="button"
                className={`w-full rounded-2xl border px-3.5 py-2.5 text-left text-sm transition ${
                  project.id === selectedProjectId
                    ? 'border-primary/60 bg-primary/12'
                    : 'border-border/85 bg-background/48 hover:bg-secondary/75'
                }`}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="block truncate text-foreground">{project.name}</strong>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {project.envLabel}
                  </span>
                </div>
              </button>

              {projectTests.length > 0 ? (
                <ul className="space-y-1 pl-3">
                  {projectTests.map((testCase) => (
                    <li key={testCase.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition ${
                          testCase.id === selectedTestId
                            ? 'border-primary/45 bg-primary/8 text-primary'
                            : 'border-border/80 bg-background/40 text-muted-foreground hover:bg-secondary/70'
                        }`}
                        onClick={() => onSelectTest(project.id, testCase.id)}
                      >
                        {testCase.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pl-3 text-xs text-muted-foreground">No test cases in this project.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
