import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { BrowserInstallScreen } from './app/components/BrowserInstallScreen';
import { LoadingScreen } from './app/components/LoadingScreen';
import { ProjectManagementPanel } from './app/components/ProjectManagementPanel';
import { ProjectSetupScreen } from './app/components/ProjectSetupScreen';
import { RunCenterPanel } from './app/components/RunCenterPanel';
import { SidebarProjectsPanel } from './app/components/SidebarProjectsPanel';
import { TestCaseEditorPanel } from './app/components/TestCaseEditorPanel';
import { ThemeToggle } from './app/components/ThemeToggle';
import { UpdateBanner } from './app/components/UpdateBanner';
import { WorkspaceDefaultsPanel } from './app/components/WorkspaceDefaultsPanel';
import { useBugReportDomain } from './app/hooks/useBugReportDomain';
import { useProjectsDomain } from './app/hooks/useProjectsDomain';
import { useRunsDomain } from './app/hooks/useRunsDomain';
import { useTestsDomain } from './app/hooks/useTestsDomain';
import { useThemePreference } from './app/hooks/useThemePreference';
import { useUpdateBanner } from './app/hooks/useUpdateBanner';
import { appShellClass, mutedButtonClass, onboardingShellClass } from './app/uiClasses';

export function App(): JSX.Element {
  const [message, setMessage] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const hasInitializedSidebar = useRef(false);

  const onMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const { theme, setTheme } = useThemePreference();
  const {
    bannerEvent: updateBannerEvent,
    isVisible: isUpdateBannerVisible,
    canInstallNow,
    isInstalling: isInstallingUpdate,
    dismiss: dismissUpdateBanner,
    installNow: installUpdateNow,
  } = useUpdateBanner({ onMessage });

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
    appConfig,
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
    isSelectedProjectDeleteBlocked,
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
    isTestEditing,
    testForm,
    setTestForm,
    parsedSteps,
    stepParsePreview,
    isValidatingSteps,
    isGeneratingSteps,
    testTitleError,
    testStepsErrors,
    canSaveTestCase,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectProject,
    beginCreateTest,
    saveTestCase,
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

  const refreshSidebar = useCallback(
    async (preferredProjectId: string = selectedProjectId, preferredTestId?: string): Promise<void> => {
      const rows = await refreshProjects(preferredProjectId);
      const nextProjectId = rows.length === 0 ? '' : rows.some((project) => project.id === preferredProjectId)
        ? preferredProjectId
        : rows[0].id;

      await refreshTestsTree(rows, nextProjectId, preferredTestId);
      await refreshActiveRunContext();
    },
    [refreshActiveRunContext, refreshProjects, refreshTestsTree, selectedProjectId],
  );

  useEffect(() => {
    if (hasInitializedSidebar.current) {
      return;
    }

    hasInitializedSidebar.current = true;
    void refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    if (!selectedProject || !isProjectFormOpen || projectFormMode !== 'edit') {
      return;
    }

    setProjectForm({
      id: selectedProject.id,
      name: selectedProject.name,
      baseUrl: selectedProject.baseUrl,
      envLabel: selectedProject.envLabel,
    });
  }, [isProjectFormOpen, projectFormMode, selectedProject, setProjectForm]);

  useEffect(() => {
    if (!message) {
      return;
    }

    toast(message);
    setMessage('');
  }, [message]);

  const hasAtLeastOneProject = projects.length > 0;
  const hasAtLeastOneTestCase = Object.values(testCasesByProject).some((tests) => tests.length > 0);
  const selectedProjectName = selectedProject?.name ?? 'No project selected';
  const canStartRun = Boolean(selectedTestId);
  const testCasePanelTitle = hasAtLeastOneTestCase ? 'Test case editor' : 'Setup first test case';
  const testCasePanelDescription = hasAtLeastOneTestCase
    ? 'Create a new test case or edit the selected one.'
    : 'Create your first test case below.';

  const activeScreen: 'loading' | 'install' | 'project' | 'main' = !isBrowserStatesLoaded
    ? 'loading'
    : !hasInstalledBrowser
      ? 'install'
      : !hasAtLeastOneProject
        ? 'project'
        : 'main';

  useEffect(() => {
    if (activeScreen !== 'project') {
      return;
    }

    beginCreateProject();
  }, [activeScreen, beginCreateProject]);

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

  const handleDeleteProject = useCallback(async (): Promise<void> => {
    await deleteSelectedProject(async () => {
      setSelectedTestId('');
      clearRunSelectionState();
      clearBugReportState();
      await refreshSidebar('');
    });
  }, [clearBugReportState, clearRunSelectionState, deleteSelectedProject, refreshSidebar]);

  const handleSaveTestCase = useCallback(async (): Promise<void> => {
    const saved = await saveTestCase();
    if (!saved) {
      return;
    }

    await refreshSidebar(selectedProjectId, saved.id);
  }, [refreshSidebar, saveTestCase, selectedProjectId]);

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

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-primary/22 blur-3xl" />
        <div className="absolute right-[-8rem] top-[-4rem] h-[20rem] w-[20rem] rounded-full bg-accent/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[22rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <ThemeToggle theme={theme} onToggle={() => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))} />
      <button
        type="button"
        className={`${mutedButtonClass} fixed bottom-4 left-4 z-50 bg-card/92 shadow-[var(--shadow-soft)] backdrop-blur-xl`}
        onClick={() => {
          void handleOpenStepDocs();
        }}
      >
        Step Docs
      </button>

      {isUpdateBannerVisible && updateBannerEvent ? (
        <UpdateBanner
          event={updateBannerEvent}
          canInstallNow={canInstallNow}
          isInstalling={isInstallingUpdate}
          onDismiss={dismissUpdateBanner}
          onInstallNow={() => {
            void installUpdateNow();
          }}
        />
      ) : null}

      <div className={activeScreen === 'main' ? appShellClass : onboardingShellClass}>
        {activeScreen === 'loading' ? <LoadingScreen /> : null}

        {activeScreen === 'install' ? (
          <BrowserInstallScreen
            browserStates={browserStates}
            browserInstallProgress={browserInstallProgress}
            hasInstalledBrowser={hasInstalledBrowser}
            onInstallBrowser={(nextBrowser) => {
              void installBrowser(nextBrowser);
            }}
          />
        ) : null}

        {activeScreen === 'project' ? (
          <ProjectSetupScreen
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            projectNameError={projectNameError}
            projectBaseUrlError={projectBaseUrlError}
            canSaveProject={canSaveProject}
            onCreateProject={() => {
              void handleCreateProject();
            }}
          />
        ) : null}

        {activeScreen === 'main' ? (
          <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="xl:sticky xl:top-4">
              <div className="flex flex-col gap-4">
                <SidebarProjectsPanel
                  projects={projects}
                  testCasesByProject={testCasesByProject}
                  selectedProjectId={selectedProjectId}
                  selectedTestId={selectedTestId}
                  onSelectProject={handleSelectProject}
                  onSelectTest={handleSelectTest}
                  onBeginCreateProject={beginCreateProject}
                />

                <ProjectManagementPanel
                  selectedProject={selectedProject}
                  selectedProjectName={selectedProjectName}
                  projectForm={projectForm}
                  setProjectForm={setProjectForm}
                  projectFormMode={projectFormMode}
                  isProjectFormOpen={isProjectFormOpen}
                  projectNameError={projectNameError}
                  projectBaseUrlError={projectBaseUrlError}
                  canSaveProject={canSaveProject}
                  isSelectedProjectDeleteBlocked={isSelectedProjectDeleteBlocked}
                  onCreateProject={() => {
                    void handleCreateProject();
                  }}
                  onUpdateSelectedProject={() => {
                    void handleUpdateProject();
                  }}
                  onCloseProjectForm={closeProjectForm}
                  onBeginEditSelectedProject={beginEditSelectedProject}
                  onDeleteSelectedProject={() => {
                    void handleDeleteProject();
                  }}
                />

                <WorkspaceDefaultsPanel appConfig={appConfig} />
              </div>
            </aside>

            <section className="flex min-w-0 flex-col gap-4">
              <TestCaseEditorPanel
                testCasePanelTitle={testCasePanelTitle}
                testCasePanelDescription={testCasePanelDescription}
                hasAtLeastOneTestCase={hasAtLeastOneTestCase}
                testForm={testForm}
                setTestForm={setTestForm}
                testTitleError={testTitleError}
                parsedSteps={parsedSteps}
                stepParsePreview={stepParsePreview}
                testStepsErrors={testStepsErrors}
                isValidatingSteps={isValidatingSteps}
                isGeneratingSteps={isGeneratingSteps}
                isTestEditing={isTestEditing}
                canSaveTestCase={canSaveTestCase}
                hasSelectedTest={Boolean(selectedTest)}
                isSelectedTestDeleteBlocked={isSelectedTestDeleteBlocked}
                onBeginCreateTest={beginCreateTest}
                onGenerateSteps={() => {
                  void generateSteps();
                }}
                onSaveTestCase={() => {
                  void handleSaveTestCase();
                }}
                onDeleteSelectedTest={() => {
                  void handleDeleteSelectedTest();
                }}
              />

              <RunCenterPanel
                selectedTestTitle={selectedTest ? selectedTest.title : 'None selected'}
                browser={browser}
                setBrowser={setBrowser}
                canStartRun={canStartRun}
                activeRunId={activeRunId}
                runs={runs}
                selectedRunId={selectedRunId}
                setSelectedRunId={setSelectedRunId}
                selectedRun={selectedRun}
                stepResults={stepResults}
                onStartRun={() => {
                  void startRun();
                }}
                onCancelRun={() => {
                  void cancelRun();
                }}
                onGenerateBugReport={() => {
                  void handleGenerateBugReport();
                }}
                isGeneratingBugReport={isGeneratingBugReport}
                bugReportVisible={Boolean(bugReport)}
                bugReportDraft={bugReportDraft}
                setBugReportDraft={setBugReportDraft}
                onCloseBugReportDraft={closeBugReportDraft}
                onCopyBugReport={() => {
                  void copyBugReport();
                }}
              />
            </section>
          </div>
        ) : null}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3200}
        closeOnClick
        newestOnTop
        pauseOnHover
        pauseOnFocusLoss={false}
        draggable={false}
        theme={theme}
      />
    </main>
  );
}
