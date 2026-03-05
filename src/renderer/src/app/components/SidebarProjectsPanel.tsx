import { useEffect, useRef, useState } from 'react';
import type { Feature, Project } from '@shared/types';
import { sidebarActionButtonClass } from '../uiClasses';

interface SidebarProjectsPanelProps {
  projects: Project[];
  featuresByProject: Record<string, Feature[]>;
  selectedProjectId: string;
  selectedFeatureId: string;
  appVersion: string;
  isProjectDeleteBlocked: (projectId: string) => boolean;
  onSelectProject: (projectId: string) => void;
  onSelectFeature: (projectId: string, featureId: string) => void;
  onBeginCreateProject: () => void;
  onCreateFeatureForProject: (projectId: string) => void;
  onBeginEditProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onBeginEditFeature: (featureId: string) => void;
  onDeleteFeature: (featureId: string) => void;
  onOpenStepDocs: () => void;
  onOpenBrowserInstall: () => void;
}

function shouldExpandProject(
  projectId: string,
  selectedProjectId: string,
  projects: Project[],
): boolean {
  if (selectedProjectId) {
    return selectedProjectId === projectId;
  }

  return projects[0]?.id === projectId;
}

export function SidebarProjectsPanel({
  projects,
  featuresByProject,
  selectedProjectId,
  selectedFeatureId,
  appVersion,
  isProjectDeleteBlocked,
  onSelectProject,
  onSelectFeature,
  onBeginCreateProject,
  onCreateFeatureForProject,
  onBeginEditProject,
  onDeleteProject,
  onBeginEditFeature,
  onDeleteFeature,
  onOpenStepDocs,
  onOpenBrowserInstall,
}: SidebarProjectsPanelProps): JSX.Element {
  const [openMenuProjectId, setOpenMenuProjectId] = useState('');
  const [openMenuFeatureId, setOpenMenuFeatureId] = useState('');
  const [isFooterMenuOpen, setIsFooterMenuOpen] = useState(false);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!sidebarRootRef.current?.contains(event.target as Node)) {
        setOpenMenuProjectId('');
        setOpenMenuFeatureId('');
        setIsFooterMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <aside
      className="relative flex h-full min-h-0 flex-col border-r border-border-divider bg-sidebar px-4 py-5"
      ref={sidebarRootRef}
    >
      <div className="space-y-5">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-sm px-0.5 py-0.5 text-[13px] text-secondary-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          onClick={onBeginCreateProject}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M3 6a3 3 0 0 1 3-3h5M21 8V6a3 3 0 0 0-3-3h-2M8 21H6a3 3 0 0 1-3-3v-2M21 14v4a3 3 0 0 1-3 3h-4M14 7l3 3M5 16v3h3l9-9a2.12 2.12 0 1 0-3-3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          New project
        </button>

        <p className="text-[11px] font-medium text-muted-foreground">
          Projects
        </p>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {projects.length === 0 ? <p className="text-[11px] text-muted-foreground">No projects yet</p> : null}

        {projects.map((project) => {
          const features = featuresByProject[project.id] ?? [];
          const isExpandedProject = shouldExpandProject(project.id, selectedProjectId, projects);
          const isProjectMenuOpen = openMenuProjectId === project.id;
          const actionVisibilityClass = isProjectMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover/project:opacity-100 group-hover/project:pointer-events-auto group-focus-within/project:opacity-100 group-focus-within/project:pointer-events-auto';

          return (
            <div key={project.id} className="space-y-1">
              <div
                className={`group/project relative flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors ${
                  isExpandedProject ? 'bg-muted text-foreground' : 'text-secondary-foreground hover:bg-card'
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm ${
                    isExpandedProject
                      ? 'bg-success text-background'
                      : 'border border-border bg-card text-muted-foreground'
                  }`}
                  aria-hidden="true"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>

                <button
                  type="button"
                  className={`min-w-0 flex-1 truncate rounded-sm text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
                    isExpandedProject ? 'font-medium text-foreground' : 'text-secondary-foreground'
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.name}
                </button>

                {isExpandedProject ? (
                  <button
                    type="button"
                    className={`${sidebarActionButtonClass} ${actionVisibilityClass}`}
                    title="Create feature"
                    aria-label={`Create feature in ${project.name}`}
                    data-testid={`project-create-feature-${project.id}`}
                    onClick={() => onCreateFeatureForProject(project.id)}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}

                <button
                  type="button"
                  className={`${sidebarActionButtonClass} ${actionVisibilityClass}`}
                  title="Project actions"
                  aria-label={`Project actions for ${project.name}`}
                  data-testid={`project-actions-${project.id}`}
                  onClick={() => {
                    setOpenMenuProjectId((previous) => (previous === project.id ? '' : project.id));
                    setOpenMenuFeatureId('');
                    setIsFooterMenuOpen(false);
                    onSelectProject(project.id);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                    <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                  </svg>
                </button>

                {isProjectMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.3rem)] z-20 w-32 rounded-md border border-border bg-card p-1 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.95)]">
                    <button
                      type="button"
                      className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                      onClick={() => {
                        setOpenMenuProjectId('');
                        onBeginEditProject(project.id);
                      }}
                    >
                      Edit project
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-danger transition-colors hover:bg-danger/16 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isProjectDeleteBlocked(project.id)}
                      onClick={() => {
                        setOpenMenuProjectId('');
                        onDeleteProject(project.id);
                      }}
                    >
                      Delete project
                    </button>
                  </div>
                ) : null}
              </div>

              {isExpandedProject && features.length > 0 ? (
                <ul className="space-y-0.5 pl-4">
                  {features.map((feature) => {
                    const isSelectedFeature = feature.id === selectedFeatureId;
                    const isFeatureMenuOpen = openMenuFeatureId === feature.id;
                    const featureActionVisibilityClass = isFeatureMenuOpen
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 pointer-events-none group-hover/feature:opacity-100 group-hover/feature:pointer-events-auto group-focus-within/feature:opacity-100 group-focus-within/feature:pointer-events-auto';

                    return (
                      <li key={feature.id} className="space-y-1">
                        <div
                          className={`group/feature relative flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors ${
                            isSelectedFeature
                              ? 'bg-card text-foreground'
                              : 'text-secondary-foreground hover:bg-card'
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className={`h-3 w-3 shrink-0 ${isSelectedFeature ? 'text-success' : 'text-muted-foreground'}`}
                            aria-hidden="true"
                          >
                            {isSelectedFeature ? (
                              <>
                                <path
                                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v2H3V7z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M3 11h18l-1.2 6.8a2 2 0 01-2 1.6H5.2a2 2 0 01-2-1.6L3 11z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                              </>
                            ) : (
                              <path
                                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinejoin="round"
                              />
                            )}
                          </svg>

                          <button
                            type="button"
                            className={`min-w-0 flex-1 truncate rounded-sm text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
                              isSelectedFeature
                                ? 'font-medium text-foreground'
                                : 'text-secondary-foreground'
                            }`}
                            onClick={() => onSelectFeature(project.id, feature.id)}
                          >
                            {feature.title}
                          </button>

                          <button
                            type="button"
                            className={`${sidebarActionButtonClass} h-5 w-5 ${featureActionVisibilityClass}`}
                            title="Feature actions"
                            aria-label={`Feature actions for ${feature.title}`}
                            data-testid={`feature-actions-${feature.id}`}
                            onClick={() => {
                              setOpenMenuFeatureId((previous) =>
                                previous === feature.id ? '' : feature.id,
                              );
                              setOpenMenuProjectId('');
                              setIsFooterMenuOpen(false);
                              onSelectFeature(project.id, feature.id);
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                              <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                              <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                            </svg>
                          </button>

                          {isFeatureMenuOpen ? (
                            <div className="absolute right-0 top-[calc(100%+0.25rem)] z-20 w-32 rounded-md border border-border bg-card p-1 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.95)]">
                              <button
                                type="button"
                                className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                                onClick={() => {
                                  setOpenMenuFeatureId('');
                                  onBeginEditFeature(feature.id);
                                }}
                              >
                                Edit feature
                              </button>
                              <button
                                type="button"
                                className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-danger transition-colors hover:bg-danger/16"
                                onClick={() => {
                                  setOpenMenuFeatureId('');
                                  onDeleteFeature(feature.id);
                                }}
                              >
                                Delete feature
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative mt-3 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">v{appVersion}</p>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            aria-label="Sidebar settings"
            title="Sidebar settings"
            onClick={() => {
              setIsFooterMenuOpen((previous) => !previous);
              setOpenMenuProjectId('');
              setOpenMenuFeatureId('');
            }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M10.5 3h3l.5 2.1a7.6 7.6 0 0 1 1.7.7l1.9-1.1l2.1 2.1l-1.1 1.9c.3.5.5 1.1.7 1.7L21 10.5v3l-2.1.5a7.6 7.6 0 0 1-.7 1.7l1.1 1.9l-2.1 2.1l-1.9-1.1c-.5.3-1.1.5-1.7.7L13.5 21h-3l-.5-2.1a7.6 7.6 0 0 1-1.7-.7l-1.9 1.1l-2.1-2.1l1.1-1.9a7.6 7.6 0 0 1-.7-1.7L3 13.5v-3l2.1-.5c.2-.6.4-1.2.7-1.7L4.7 6.4l2.1-2.1l1.9 1.1c.5-.3 1.1-.5 1.7-.7L10.5 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        {isFooterMenuOpen ? (
          <div className="absolute bottom-[calc(100%+0.4rem)] right-0 z-20 w-36 rounded-md border border-border bg-card p-1 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.95)]">
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
              onClick={() => {
                setIsFooterMenuOpen(false);
                onOpenStepDocs();
              }}
            >
              Step docs
            </button>
            <button
              type="button"
              className="block w-full rounded-sm px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
              onClick={() => {
                setIsFooterMenuOpen(false);
                onOpenBrowserInstall();
              }}
            >
              Browser install
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
