import { useEffect, useRef, useState } from 'react';
import type { Feature, Project } from '@shared/types';
import type { ThemeMode } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProjectsPanelProps {
  projects: Project[];
  featuresByProject: Record<string, Feature[]>;
  selectedProjectId: string;
  selectedFeatureId: string;
  theme: ThemeMode;
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
  onChangeTheme: (mode: ThemeMode) => void;
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
  theme,
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
  onChangeTheme,
  onOpenStepDocs,
  onOpenBrowserInstall,
}: SidebarProjectsPanelProps): JSX.Element {
  const isDark = theme === 'dark';
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
      className={`relative flex h-full min-h-0 flex-col gap-5 border-r px-4 pt-3 pb-5 ${
        isDark ? 'border-[#1F1F1F] bg-[#0C0C0C]' : 'border-[#E2E8F0] bg-[#F8FAFC]'
      }`}
      ref={sidebarRootRef}
    >
      <div className="relative h-0 w-full">
        <div className="absolute right-0 top-1 z-10">
          <ThemeToggle
            theme={theme}
            onChange={(mode) => {
              onChangeTheme(mode);
            }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <button
            type="button"
            className={`inline-flex w-full items-center gap-2 rounded-sm px-0 py-2 text-[13px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
              isDark ? 'text-[#A3A3A3]' : 'text-[#6B7280]'
            }`}
            onClick={onBeginCreateProject}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.3 2.7a1.7 1.7 0 0 1 2.4 2.4L12 13.8l-3.5.9l.9-3.5l8.8-8.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            New project
          </button>

          <p className={`text-[11px] font-medium ${isDark ? 'text-[#737373]' : 'text-[#9CA3AF]'}`}>
            Projects
          </p>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <p className={`text-[11px] ${isDark ? 'text-[#737373]' : 'text-[#9CA3AF]'}`}>
                No projects yet
              </p>
            ) : null}

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
                    className={`group/project relative flex items-center gap-2 rounded px-2.5 py-2 transition-colors ${
                      isExpandedProject
                        ? isDark
                          ? 'bg-[#1A1A1A] text-foreground'
                          : 'bg-[#22C55E0A] text-foreground'
                        : isDark
                          ? 'text-[#737373] hover:bg-[#0A0A0A]'
                          : 'text-[#9CA3AF] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        isExpandedProject
                          ? 'bg-success text-[#F8FAFC]'
                          : isDark
                            ? 'border border-[#1F1F1F] bg-[#0A0A0A] text-[#737373]'
                            : 'border border-[#E2E8F0] bg-[#F9FAFB] text-[#9CA3AF]'
                      }`}
                      aria-hidden="true"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>

                    <button
                      type="button"
                      className={`min-w-0 flex-1 truncate rounded-sm text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
                        isExpandedProject
                          ? 'font-medium text-foreground'
                          : isDark
                            ? 'text-[#737373]'
                            : 'text-[#9CA3AF]'
                      }`}
                      onClick={() => onSelectProject(project.id)}
                    >
                      {project.name}
                    </button>

                    {isExpandedProject ? (
                      <button
                        type="button"
                        className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors hover:text-secondary-foreground ${
                          isDark
                            ? 'text-[#737373] hover:bg-[#1A1A1A]'
                            : 'text-[#9CA3AF] hover:bg-[#F1F5F9]'
                        }`}
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
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 ${
                        isDark
                          ? 'border-[#1F1F1F] bg-[#0A0A0A] text-[#737373] hover:border-[#2B2B2B] hover:text-foreground hover:bg-[#1A1A1A]'
                          : 'border-[#E2E8F0] bg-[#F9FAFB] text-[#9CA3AF] hover:border-[#D1D5DB] hover:text-secondary-foreground hover:bg-[#F1F5F9]'
                      } ${actionVisibilityClass}`}
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
                      <div className="absolute right-0 top-[calc(100%+0.3rem)] z-20 w-32 rounded-md border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
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
                              className={`group/feature relative flex items-center gap-2 rounded px-2.5 py-1.5 transition-colors ${
                                isSelectedFeature
                                  ? isDark
                                    ? 'bg-[#1A1A1A] text-foreground'
                                    : 'bg-[#22C55E0A] text-foreground'
                                  : isDark
                                    ? 'text-[#737373] hover:bg-[#0A0A0A]'
                                    : 'text-[#9CA3AF] hover:bg-[#F9FAFB]'
                              }`}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className={`h-3 w-3 shrink-0 ${
                                  isSelectedFeature ? 'text-success' : isDark ? 'text-[#737373]' : 'text-[#9CA3AF]'
                                }`}
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
                                    : isDark
                                      ? 'text-[#737373]'
                                      : 'text-[#9CA3AF]'
                                }`}
                                onClick={() => onSelectFeature(project.id, feature.id)}
                              >
                                {feature.title}
                              </button>

                              <button
                                type="button"
                                className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 ${
                                  isDark
                                    ? 'border-[#1F1F1F] bg-[#0A0A0A] text-[#737373] hover:border-[#2B2B2B] hover:text-foreground hover:bg-[#1A1A1A]'
                                    : 'border-[#E2E8F0] bg-[#F9FAFB] text-[#9CA3AF] hover:border-[#D1D5DB] hover:text-secondary-foreground hover:bg-[#F1F5F9]'
                                } ${featureActionVisibilityClass}`}
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
                                <div className="absolute right-0 top-[calc(100%+0.25rem)] z-20 w-32 rounded-md border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
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
        </div>

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className={`text-[11px] ${isDark ? 'text-[#737373]' : 'text-[#6B7280]'}`}>
              v{appVersion}
            </p>
            <button
              type="button"
              className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 ${
                isDark
                  ? 'text-[#737373] hover:bg-[#1A1A1A]'
                  : 'text-[#6B7280] hover:bg-[#F1F5F9]'
              }`}
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
                  d="M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 0 0 0-6.4Zm8.1 3.2l-1.6-.6a6.6 6.6 0 0 0-.5-1.4l.8-1.5l-1.8-1.8l-1.5.8a6.6 6.6 0 0 0-1.4-.5L13.5 4h-3l-.6 1.6a6.6 6.6 0 0 0-1.4.5L7 5.3L5.2 7.1l.8 1.5a6.6 6.6 0 0 0-.5 1.4L4 10.5v3l1.6.6c.1.5.3 1 .5 1.4L5.3 17l1.8 1.8l1.5-.8c.4.2.9.4 1.4.5l.6 1.6h3l.6-1.6c.5-.1 1-.3 1.4-.5l1.5.8l1.8-1.8l-.8-1.5c.2-.4.4-.9.5-1.4l1.6-.6v-3Z"
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
            <div className="absolute bottom-[calc(100%+0.4rem)] right-0 z-20 w-36 rounded-md border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
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
      </div>
    </aside>
  );
}
