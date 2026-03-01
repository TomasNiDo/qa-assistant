import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import type { RunStatus, TestCase } from '@shared/types';
import { BrowserInstallScreen } from './app/components/BrowserInstallScreen';
import { BugReportModal } from './app/components/BugReportModal';
import { LoadingScreen } from './app/components/LoadingScreen';
import { ProjectModal } from './app/components/ProjectModal';
import { ProjectSetupScreen } from './app/components/ProjectSetupScreen';
import { RunCenterPanel } from './app/components/RunCenterPanel';
import { SidebarProjectsPanel } from './app/components/SidebarProjectsPanel';
import { TestCaseEditorPanel } from './app/components/TestCaseEditorPanel';
import { useBugReportDomain } from './app/hooks/useBugReportDomain';
import { useProjectsDomain } from './app/hooks/useProjectsDomain';
import { useRunsDomain } from './app/hooks/useRunsDomain';
import { useTestsDomain } from './app/hooks/useTestsDomain';
import { appShellClass } from './app/uiClasses';

export function App(): JSX.Element {
  const [message, setMessage] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [latestRunStatusByTestId, setLatestRunStatusByTestId] = useState<Record<string, RunStatus>>({});
  const [appVersion, setAppVersion] = useState('0.0.0');
  const [isBrowserInstallScreenOpen, setIsBrowserInstallScreenOpen] = useState(false);
  const hasInitializedSidebar = useRef(false);

  const onMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const {
    runs,
    selectedRunId,
    setSelectedRunId,
    selectedRun,
    stepResults,
    browser,
    setBrowser,
    browserStates,
    browserInstallProgress,
    isBrowserStatesLoaded,
    hasInstalledBrowser,
    activeRunId,
    activeRunContext,
    refreshActiveRunContext,
    startRun,
    cancelRun,
    installBrowser,
    clearRunSelectionState,
  } = useRunsDomain({
    selectedTestId,
    onMessage,
  });

  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    projectForm,
    setProjectForm,
    projectFormMode,
    isProjectFormOpen,
    projectNameError,
    projectBaseUrlError,
    canSaveProject,
    isProjectDeleteBlocked,
    refreshProjects,
    beginCreateProject,
    beginEditSelectedProject,
    closeProjectForm,
    createProject,
    updateSelectedProject,
    deleteSelectedProject,
  } = useProjectsDomain({
    activeRunContext,
    onMessage,
  });

  const {
    testCasesByProject,
    selectedTest,
    testForm,
    setTestForm,
    isGeneratingSteps,
    isValidatingCustomCode,
    testTitleError,
    customCodeError,
    testStepsErrors,
    stepParseWarnings,
    ambiguousStepWarningCount,
    hasStepErrors,
    isValidatingSteps,
    effectiveCode,
    isCodeModified,
    autoSaveStatus,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectProject,
    beginCreateTest,
    setEditorView,
    enableCodeEditing,
    updateCodeDraft,
    restoreGeneratedCode,
    deleteSelectedTest,
    generateSteps,
  } = useTestsDomain({
    projects,
    selectedProjectId,
    selectedProject,
    activeRunContext,
    selectedTestId,
    setSelectedTestId,
    onMessage,
  });

  const {
    bugReport,
    bugReportDraft,
    setBugReportDraft,
    isGeneratingBugReport,
    generateBugReport,
    copyBugReport,
    closeBugReportDraft,
    clearBugReportState,
  } = useBugReportDomain({ onMessage });

  const refreshLatestRunStatusByTestId = useCallback(
    async (tree: Record<string, TestCase[]>): Promise<void> => {
      const testIds = Object.values(tree).flatMap((testCases) => testCases.map((testCase) => testCase.id));
      if (testIds.length === 0) {
        setLatestRunStatusByTestId({});
        return;
      }

      const responses = await Promise.all(
        testIds.map(async (testId) => {
          const result = await window.qaApi.runHistory(testId);
          if (!result.ok || result.data.length === 0) {
            return [testId, undefined] as const;
          }

          const latestRun = result.data[result.data.length - 1];
          return [testId, latestRun.status] as const;
        }),
      );

      const nextMap: Record<string, RunStatus> = {};
      for (const [testId, status] of responses) {
        if (status) {
          nextMap[testId] = status;
        }
      }

      setLatestRunStatusByTestId(nextMap);
    },
    [],
  );

  const refreshSidebar = useCallback(
    async (preferredProjectId: string = selectedProjectId, preferredTestId?: string): Promise<void> => {
      const rows = await refreshProjects(preferredProjectId);
      const nextProjectId = rows.length === 0 ? '' : rows.some((project) => project.id === preferredProjectId)
        ? preferredProjectId
        : rows[0].id;

      const nextTree = await refreshTestsTree(rows, nextProjectId, preferredTestId);
      await refreshLatestRunStatusByTestId(nextTree);
      await refreshActiveRunContext();
    },
    [refreshActiveRunContext, refreshLatestRunStatusByTestId, refreshProjects, refreshTestsTree, selectedProjectId],
  );

  useEffect(() => {
    if (hasInitializedSidebar.current) {
      return;
    }

    hasInitializedSidebar.current = true;
    void refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    void (async () => {
      const result = await window.qaApi.appGetVersion();
      if (!result.ok) {
        onMessage(`Unable to load app version: ${result.error.message}`);
        return;
      }

      setAppVersion(result.data);
    })();
  }, [onMessage]);

  useEffect(() => {
    if (!message) {
      return;
    }

    toast(message);
    setMessage('');
  }, [message]);

  useEffect(() => {
    if (!selectedTestId) {
      return;
    }

    const latestRun = runs[0];
    setLatestRunStatusByTestId((previous) => {
      if (!latestRun) {
        if (!(selectedTestId in previous)) {
          return previous;
        }

        const nextMap = { ...previous };
        delete nextMap[selectedTestId];
        return nextMap;
      }

      if (previous[selectedTestId] === latestRun.status) {
        return previous;
      }

      return {
        ...previous,
        [selectedTestId]: latestRun.status,
      };
    });
  }, [runs, selectedTestId]);

  const hasAtLeastOneProject = projects.length > 0;
  const hasAtLeastOneTestCase = Object.values(testCasesByProject).some((tests) => tests.length > 0);
  const canStartRun =
    Boolean(selectedTestId) &&
    !customCodeError &&
    !isValidatingCustomCode &&
    !isValidatingSteps &&
    !hasStepErrors;

  const activeScreen: 'loading' | 'install' | 'empty' | 'main' = !isBrowserStatesLoaded
    ? 'loading'
    : !hasInstalledBrowser || isBrowserInstallScreenOpen
      ? 'install'
      : !hasAtLeastOneProject
        ? 'empty'
        : 'main';

  const handleSelectProject = useCallback(
    (projectId: string): void => {
      setSelectedProjectId(projectId);
      selectProject(projectId);
    },
    [selectProject, setSelectedProjectId],
  );

  const handleSelectTest = useCallback(
    (projectId: string, testId: string): void => {
      setSelectedProjectId(projectId);
      setSelectedTestId(testId);
    },
    [setSelectedProjectId],
  );

  const handleCreateProject = useCallback(async (): Promise<void> => {
    const created = await createProject();
    if (!created) {
      return;
    }

    await refreshSidebar(created.id);
    onMessage('Project created.');
  }, [createProject, onMessage, refreshSidebar]);

  const handleUpdateProject = useCallback(async (): Promise<void> => {
    const updated = await updateSelectedProject();
    if (!updated) {
      return;
    }

    await refreshSidebar(updated.id, selectedTestId || undefined);
    onMessage('Project updated.');
  }, [onMessage, refreshSidebar, selectedTestId, updateSelectedProject]);

  const handleDeleteProjectById = useCallback(async (projectId: string): Promise<void> => {
    await deleteSelectedProject(async () => {
      const shouldClearSelection = selectedProjectId === projectId;
      if (shouldClearSelection) {
        setSelectedTestId('');
        clearRunSelectionState();
        clearBugReportState();
      }
      await refreshSidebar(shouldClearSelection ? '' : selectedProjectId);
    }, projectId);
  }, [clearBugReportState, clearRunSelectionState, deleteSelectedProject, refreshSidebar, selectedProjectId]);

  const handleDeleteSelectedTest = useCallback(async (): Promise<void> => {
    await deleteSelectedTest(async () => {
      clearRunSelectionState();
      clearBugReportState();
      await refreshSidebar(selectedProjectId);
    });
  }, [clearBugReportState, clearRunSelectionState, deleteSelectedTest, refreshSidebar, selectedProjectId]);

  const handleGenerateBugReport = useCallback(async (): Promise<void> => {
    await generateBugReport(selectedRunId);
  }, [generateBugReport, selectedRunId]);

  const handleOpenStepDocs = useCallback(async (): Promise<void> => {
    const result = await window.qaApi.openStepDocs();
    if (!result.ok) {
      onMessage(`Unable to open step docs: ${result.error.message}`);
      return;
    }

    onMessage('Opened step writing docs in your default browser.');
  }, [onMessage]);

  if (activeScreen === 'loading') {
    return (
      <main className="h-screen w-screen bg-background">
        <div className="flex h-full w-full items-center justify-center bg-background">
          <LoadingScreen />
        </div>
        <ToastContainer position="top-right" autoClose={3200} closeOnClick newestOnTop pauseOnHover pauseOnFocusLoss={false} draggable={false} theme="dark" />
      </main>
    );
  }

  if (activeScreen === 'install') {
    return (
      <main className="h-screen w-screen bg-background">
        <div className="h-full w-full overflow-hidden bg-[#0b0d12]">
          <BrowserInstallScreen
            browserStates={browserStates}
            browserInstallProgress={browserInstallProgress}
            hasInstalledBrowser={hasInstalledBrowser}
            onBackToWorkspace={isBrowserInstallScreenOpen ? () => setIsBrowserInstallScreenOpen(false) : undefined}
            onInstallBrowser={(nextBrowser) => {
              void installBrowser(nextBrowser);
            }}
          />
        </div>
        <ToastContainer position="top-right" autoClose={3200} closeOnClick newestOnTop pauseOnHover pauseOnFocusLoss={false} draggable={false} theme="dark" />
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-background">
      <div className={appShellClass}>
        <SidebarProjectsPanel
          projects={projects}
          testCasesByProject={testCasesByProject}
          latestRunStatusByTestId={latestRunStatusByTestId}
          selectedProjectId={selectedProjectId}
          selectedTestId={selectedTestId}
          appVersion={appVersion}
          isProjectDeleteBlocked={isProjectDeleteBlocked}
          onSelectProject={handleSelectProject}
          onSelectTest={handleSelectTest}
          onBeginCreateProject={beginCreateProject}
          onCreateTestForProject={(projectId) => {
            handleSelectProject(projectId);
            beginCreateTest();
          }}
          onBeginEditProject={(projectId) => beginEditSelectedProject(projectId)}
          onDeleteProject={(projectId) => {
            void handleDeleteProjectById(projectId);
          }}
          onOpenStepDocs={() => {
            void handleOpenStepDocs();
          }}
          onOpenBrowserInstall={() => {
            setIsBrowserInstallScreenOpen(true);
          }}
        />

        <section className="min-w-0 overflow-y-auto bg-transparent px-7 py-6">
          {activeScreen === 'empty' ? (
            <ProjectSetupScreen
              onBeginCreateProject={beginCreateProject}
            />
          ) : (
            <div className="space-y-4">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-[#edf3fb]">Test Execution Workspace</h1>
                  <p className="text-sm text-[#a9b8cb]">Draft steps, validate run readiness, then execute with clear result summaries.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#121c2a]/75 px-3 py-1.5 text-xs font-semibold text-[#d9e4f5]">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      autoSaveStatus === 'saving' ? 'animate-pulse bg-warning' : 'bg-success'
                    }`}
                    aria-hidden="true"
                  />
                  {autoSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
                </span>
              </header>

              <section className="rounded-2xl bg-[#101722]/55 px-3 py-2.5">
                <p className="text-[11px] font-semibold tracking-wide text-[#90a7c3]">Run Workflow</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#17314f]/85 px-2.5 py-1 text-[11px] font-semibold text-[#9fd1ff]">
                    1. Metadata
                  </span>
                  <span className="rounded-full bg-[#121c2a]/70 px-2.5 py-1 text-[11px] font-medium text-[#aac0db]">
                    2. Steps
                  </span>
                  <span className="rounded-full bg-[#121c2a]/70 px-2.5 py-1 text-[11px] font-medium text-[#aac0db]">
                    3. Start Run
                  </span>
                  <span className="rounded-full bg-[#121c2a]/70 px-2.5 py-1 text-[11px] font-medium text-[#aac0db]">
                    4. Review
                  </span>
                </div>
              </section>

              <TestCaseEditorPanel
                testCasePanelTitle="Scenario Setup"
                testCasePanelDescription="Define metadata first, then author or review execution input before running."
                hasAtLeastOneTestCase={hasAtLeastOneTestCase}
                testForm={testForm}
                setTestForm={setTestForm}
                testTitleError={testTitleError}
                customCodeError={customCodeError}
                testStepsErrors={testStepsErrors}
                stepParseWarnings={stepParseWarnings}
                ambiguousStepWarningCount={ambiguousStepWarningCount}
                isGeneratingSteps={isGeneratingSteps}
                hasSelectedTest={Boolean(selectedTest)}
                isSelectedTestDeleteBlocked={isSelectedTestDeleteBlocked}
                effectiveCode={effectiveCode}
                isCodeModified={isCodeModified}
                browser={browser}
                setBrowser={setBrowser}
                canStartRun={canStartRun}
                setEditorView={setEditorView}
                onEnableCodeEditing={enableCodeEditing}
                onCodeChange={updateCodeDraft}
                onRestoreGeneratedCode={restoreGeneratedCode}
                onBeginCreateTest={beginCreateTest}
                onGenerateSteps={() => {
                  void generateSteps();
                }}
                onDeleteSelectedTest={() => {
                  void handleDeleteSelectedTest();
                }}
                onStartRun={() => {
                  void startRun();
                }}
              />

              <RunCenterPanel
                runs={runs}
                selectedRunId={selectedRunId}
                setSelectedRunId={setSelectedRunId}
                selectedRun={selectedRun}
                stepResults={stepResults}
                activeRunId={activeRunId}
                onCancelRun={() => {
                  void cancelRun();
                }}
                onRerun={() => {
                  void startRun();
                }}
                canRerun={canStartRun}
                onGenerateBugReport={() => {
                  void handleGenerateBugReport();
                }}
                isGeneratingBugReport={isGeneratingBugReport}
                canGenerateBugReport={Boolean(selectedRun && selectedRun.status === 'failed')}
              />
            </div>
          )}
        </section>
      </div>

      {isProjectFormOpen ? (
        <ProjectModal
          projectForm={projectForm}
          setProjectForm={setProjectForm}
          projectFormMode={projectFormMode}
          projectNameError={projectNameError}
          projectBaseUrlError={projectBaseUrlError}
          canSaveProject={canSaveProject}
          onClose={closeProjectForm}
          onCreateProject={() => {
            void handleCreateProject();
          }}
          onUpdateProject={() => {
            void handleUpdateProject();
          }}
        />
      ) : null}

      {bugReport ? (
        <BugReportModal
          draft={bugReportDraft}
          setDraft={setBugReportDraft}
          onClose={closeBugReportDraft}
          onCopy={() => {
            void copyBugReport();
          }}
        />
      ) : null}

      <ToastContainer
        position="top-right"
        autoClose={3200}
        closeOnClick
        newestOnTop
        pauseOnHover
        pauseOnFocusLoss={false}
        draggable={false}
        theme="dark"
      />
    </main>
  );
}
