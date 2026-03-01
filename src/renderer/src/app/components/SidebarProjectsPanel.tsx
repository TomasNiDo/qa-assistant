import { useEffect, useRef, useState } from 'react';
import type { Feature, Project, RunStatus, TestCase } from '@shared/types';

interface SidebarProjectsPanelProps {
  projects: Project[];
  featuresByProject: Record<string, Feature[]>;
  testCasesByFeature: Record<string, TestCase[]>;
  latestRunStatusByTestId: Record<string, RunStatus>;
  selectedProjectId: string;
  selectedFeatureId: string;
  selectedTestId: string;
  appVersion: string;
  isProjectDeleteBlocked: (projectId: string) => boolean;
  onSelectProject: (projectId: string) => void;
  onSelectFeature: (projectId: string, featureId: string) => void;
  onSelectTest: (projectId: string, featureId: string, testId: string) => void;
  onBeginCreateProject: () => void;
  onCreateFeatureForProject: (projectId: string) => void;
  onCreateTestForFeature: (projectId: string, featureId: string) => void;
  onBeginEditProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onBeginEditFeature: (featureId: string) => void;
  onDeleteFeature: (featureId: string) => void;
  onOpenStepDocs: () => void;
  onOpenBrowserInstall: () => void;
}

export function SidebarProjectsPanel({
  projects,
  featuresByProject,
  testCasesByFeature,
  latestRunStatusByTestId,
  selectedProjectId,
  selectedFeatureId,
  selectedTestId,
  appVersion,
  isProjectDeleteBlocked,
  onSelectProject,
  onSelectFeature,
  onSelectTest,
  onBeginCreateProject,
  onCreateFeatureForProject,
  onCreateTestForFeature,
  onBeginEditProject,
  onDeleteProject,
  onBeginEditFeature,
  onDeleteFeature,
  onOpenStepDocs,
  onOpenBrowserInstall,
}: SidebarProjectsPanelProps): JSX.Element {
  const [openMenuProjectId, setOpenMenuProjectId] = useState('');
  const [openMenuFeatureId, setOpenMenuFeatureId] = useState('');
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!menuRootRef.current?.contains(event.target as Node)) {
        setOpenMenuProjectId('');
        setOpenMenuFeatureId('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function getTestIndicatorClass(status: RunStatus | undefined): string {
    if (status === 'passed') {
      return 'bg-[#2bb673]';
    }

    if (status === 'failed') {
      return 'bg-[#d85b75]';
    }

    return 'bg-[#6f7f95]';
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#0e131b]/95 px-3 py-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-0.5 py-0.5 text-[13px] font-normal text-[#e6edf7] transition hover:text-white"
            onClick={onBeginCreateProject}
          >
            <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] text-[#9fb0c8]" aria-hidden="true">
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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center text-[#9fb0c8] transition hover:text-[#d6e2f4]"
              onClick={onOpenStepDocs}
              aria-label="Open step documentation"
              title="Open step documentation"
            >
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center text-[#9fb0c8] transition hover:text-[#d6e2f4]"
              onClick={onOpenBrowserInstall}
              aria-label="Open browser installation settings"
              title="Open browser installation settings"
            >
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
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
        </div>

        <p className="text-[11px] font-semibold text-[#8b96a5]">Projects</p>
      </div>

      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" ref={menuRootRef}>
        {projects.length === 0 ? (
          <p className="text-[11px] text-[#6f7d91]">No projects yet</p>
        ) : null}

        {projects.map((project) => {
          const features = featuresByProject[project.id] ?? [];
          const isSelectedProject = project.id === selectedProjectId;
          const isProjectMenuOpen = openMenuProjectId === project.id;
          const actionVisibilityClass = isProjectMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover/project:opacity-100 group-hover/project:pointer-events-auto group-focus-within/project:opacity-100 group-focus-within/project:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto';

          return (
            <div key={project.id} className="space-y-1">
              <div
                className={`group/project relative flex items-center gap-1 rounded-xl px-1 py-1 transition ${
                  isSelectedProject ? 'bg-[#122131]/75' : 'hover:bg-[#121927]/75'
                }`}
              >
                <button
                  type="button"
                  className={`min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-xs font-medium transition ${
                    isSelectedProject ? 'text-[#d7e1f0]' : 'text-[#b8c2cf]'
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  {project.name}
                </button>

                <button
                  type="button"
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary/65 text-[#c2d0e6] transition hover:bg-secondary/85 ${actionVisibilityClass}`}
                  title="Create feature"
                  aria-label={`Create feature in ${project.name}`}
                  data-testid={`project-create-feature-${project.id}`}
                  onClick={() => {
                    onSelectProject(project.id);
                    onCreateFeatureForProject(project.id);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary/65 text-[#c2d0e6] transition hover:bg-secondary/85 ${actionVisibilityClass}`}
                  title="Project actions"
                  aria-label={`Project actions for ${project.name}`}
                  data-testid={`project-actions-${project.id}`}
                  onClick={() => {
                    setOpenMenuProjectId((previous) =>
                      previous === project.id ? '' : project.id,
                    );
                    setOpenMenuFeatureId('');
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
                  <div className="absolute right-0 top-[calc(100%+0.3rem)] z-20 w-32 rounded-xl bg-[#11161d]/95 p-1 shadow-[0_12px_30px_-18px_hsl(220_70%_3%/0.95)]">
                    <button
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-[#cbd3dd] transition hover:bg-[#1a2230]"
                      onClick={() => {
                        setOpenMenuProjectId('');
                        onBeginEditProject(project.id);
                      }}
                    >
                      Edit project
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-[#f1a3b4] transition hover:bg-[#2a1a24] disabled:cursor-not-allowed disabled:opacity-50"
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

              {features.length > 0 ? (
                <ul className="space-y-1 pl-2">
                  {features.map((feature) => {
                    const tests = testCasesByFeature[feature.id] ?? [];
                    const isSelectedFeature = feature.id === selectedFeatureId;
                    const isFeatureMenuOpen = openMenuFeatureId === feature.id;
                    const featureActionVisibilityClass = isFeatureMenuOpen
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 pointer-events-none group-hover/feature:opacity-100 group-hover/feature:pointer-events-auto group-focus-within/feature:opacity-100 group-focus-within/feature:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto';

                    return (
                      <li key={feature.id} className="space-y-1">
                        <div
                          className={`group/feature relative flex items-center gap-1 rounded-lg px-1 py-1 transition ${
                            isSelectedFeature ? 'bg-[#10273a]/70' : 'hover:bg-[#122031]/70'
                          }`}
                        >
                          <button
                            type="button"
                            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[11px] font-medium transition ${
                              isSelectedFeature ? 'text-[#d7e9ff]' : 'text-[#9fb2ca]'
                            }`}
                            onClick={() => onSelectFeature(project.id, feature.id)}
                          >
                            {feature.title}
                          </button>

                          <button
                            type="button"
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary/60 text-[#c2d0e6] transition hover:bg-secondary/85 ${featureActionVisibilityClass}`}
                            title="Create test case"
                            aria-label={`Create test case in feature ${feature.title}`}
                            data-testid={`feature-create-test-${feature.id}`}
                            onClick={() => {
                              onSelectFeature(project.id, feature.id);
                              onCreateTestForFeature(project.id, feature.id);
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary/60 text-[#c2d0e6] transition hover:bg-secondary/85 ${featureActionVisibilityClass}`}
                            title="Feature actions"
                            aria-label={`Feature actions for ${feature.title}`}
                            data-testid={`feature-actions-${feature.id}`}
                            onClick={() => {
                              setOpenMenuFeatureId((previous) =>
                                previous === feature.id ? '' : feature.id,
                              );
                              setOpenMenuProjectId('');
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
                            <div className="absolute right-0 top-[calc(100%+0.25rem)] z-20 w-32 rounded-xl bg-[#11161d]/95 p-1 shadow-[0_12px_30px_-18px_hsl(220_70%_3%/0.95)]">
                              <button
                                type="button"
                                className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-[#cbd3dd] transition hover:bg-[#1a2230]"
                                onClick={() => {
                                  setOpenMenuFeatureId('');
                                  onBeginEditFeature(feature.id);
                                }}
                              >
                                Edit feature
                              </button>
                              <button
                                type="button"
                                className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-[#f1a3b4] transition hover:bg-[#2a1a24]"
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

                        {tests.length > 0 ? (
                          <ul className="space-y-1 pl-2">
                            {tests.map((testCase) => (
                              <li key={testCase.id}>
                                <button
                                  type="button"
                                  className={`w-full rounded-xl px-2 py-1 text-left text-xs transition ${
                                    testCase.id === selectedTestId
                                      ? 'bg-[#173452]/75 text-[#e4edf9]'
                                      : 'text-[#b8c2cf] hover:bg-[#131c2b]/75'
                                  }`}
                                  onClick={() =>
                                    onSelectTest(project.id, feature.id, testCase.id)
                                  }
                                >
                                  <span
                                    className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${getTestIndicatorClass(
                                      latestRunStatusByTestId[testCase.id],
                                    )}`}
                                    data-testid={`test-status-${testCase.id}`}
                                    aria-hidden="true"
                                  />
                                  <span className="align-middle">{testCase.title}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="pl-2 text-[11px] text-[#6f7d91]">No test cases yet</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="pl-2 text-[11px] text-[#6f7d91]">No features yet</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="pt-2 text-[10px] text-[#5f6b7c]">v{appVersion}</p>
    </aside>
  );
}
