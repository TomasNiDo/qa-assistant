import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import type {
  BrowserName,
  Feature,
  FeatureExecutionSummary,
  TestCase,
  TestPlanningStatus,
} from '@shared/types';
import { BrowserInstallScreen } from './app/components/BrowserInstallScreen';
import {
  DraftedTestCaseModal,
  type DraftedTestCaseFormState,
} from './app/components/DraftedTestCaseModal';
import { FeatureExecutionPage } from './app/components/FeatureExecutionPage';
import { FeaturePlanningPage } from './app/components/FeaturePlanningPage';
import { LoadingScreen } from './app/components/LoadingScreen';
import { ProjectModal } from './app/components/ProjectModal';
import { ProjectSetupScreen } from './app/components/ProjectSetupScreen';
import { RunCenterPanel } from './app/components/RunCenterPanel';
import { SidebarProjectsPanel } from './app/components/SidebarProjectsPanel';
import { TestCaseEditorPanel } from './app/components/TestCaseEditorPanel';
import { useFeaturesDomain } from './app/hooks/useFeaturesDomain';
import { useProjectsDomain } from './app/hooks/useProjectsDomain';
import { useRunsDomain } from './app/hooks/useRunsDomain';
import { useTestsDomain } from './app/hooks/useTestsDomain';
import { toErrorMessage } from './app/utils';
import {
  appShellClass,
  primaryButtonClass,
} from './app/uiClasses';

const DEFAULT_DRAFTED_TEST_CASE_FORM: DraftedTestCaseFormState = {
  id: '',
  title: '',
  testType: 'positive',
  priority: 'medium',
};

function buildFeatureSignature(
  projectId: string,
  featureId: string,
  title: string,
  acceptanceCriteria: string,
  requirements: string,
  notes: string,
): string {
  return [
    projectId,
    featureId,
    title.trim(),
    acceptanceCriteria.trim(),
    requirements.trim(),
    notes.trim(),
  ].join('::');
}

function mapTestPlanningStatusUpdateError(message: string): string {
  if (
    message.includes('Invalid test.update payload') &&
    message.includes("Unrecognized key(s) in object: 'planningStatus'")
  ) {
    return 'Approving test cases requires the latest main-process handlers. Restart QA Assistant and try again.';
  }

  return message;
}

function formatRelativeTimestamp(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60_000));

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

export function App(): JSX.Element {
  const [message, setMessage] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [appVersion, setAppVersion] = useState('0.0.0');
  const [isBrowserInstallScreenOpen, setIsBrowserInstallScreenOpen] = useState(false);
  const [featureAutoSaveStatus, setFeatureAutoSaveStatus] = useState<
    'saving' | 'saved' | 'error'
  >('saved');
  const [featureAutoSaveMessage, setFeatureAutoSaveMessage] = useState('Saved');
  const [isDraftedTestCaseModalOpen, setIsDraftedTestCaseModalOpen] = useState(false);
  const [draftedTestCaseModalMode, setDraftedTestCaseModalMode] = useState<'create' | 'edit'>(
    'create',
  );
  const [draftedTestCaseForm, setDraftedTestCaseForm] = useState<DraftedTestCaseFormState>(
    DEFAULT_DRAFTED_TEST_CASE_FORM,
  );
  const [selectedDraftedTestIds, setSelectedDraftedTestIds] = useState<string[]>([]);
  const [featurePhase, setFeaturePhase] = useState<'planning' | 'execution' | 'workspace'>(
    'planning',
  );
  const [executionFilter, setExecutionFilter] = useState<
    'all' | 'passed' | 'failed' | 'running' | 'not_run'
  >('all');
  const [executionSummary, setExecutionSummary] = useState<FeatureExecutionSummary | null>(null);
  const [isGeneratingAiScenarios, setIsGeneratingAiScenarios] = useState(false);

  const hasInitializedSidebar = useRef(false);
  const featureAutoSaveVersion = useRef(0);
  const lastSavedFeatureSignatureRef = useRef('');
  const workspaceTitleInputRef = useRef<HTMLInputElement | null>(null);

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
    activeRunId,
    browserStates,
    browserInstallProgress,
    isBrowserStatesLoaded,
    hasInstalledBrowser,
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
    featuresByProject,
    selectedFeatureId,
    setSelectedFeatureId,
    selectedFeature,
    featureForm,
    setFeatureForm,
    featureFormMode,
    featureTitleError,
    featureAcceptanceCriteriaError,
    canSaveFeature,
    refreshFeaturesTree,
    selectProject,
    beginCreateFeature,
    beginEditSelectedFeature,
    createFeature,
    updateSelectedFeature,
    deleteSelectedFeature,
  } = useFeaturesDomain({
    selectedProjectId,
    onMessage,
  });

  const {
    selectedFeatureTests,
    selectedTest,
    selectedTestHasSteps,
    testForm,
    setTestForm,
    testTitleError,
    customCodeError,
    testStepsErrors,
    stepParseWarnings,
    ambiguousStepWarningCount,
    isGeneratingSteps,
    effectiveCode,
    isCodeModified,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectFeature,
    beginCreateTest,
    setEditorView,
    enableCodeEditing,
    updateCodeDraft,
    restoreGeneratedCode,
    deleteSelectedTest,
    generateSteps,
  } = useTestsDomain({
    featuresByProject,
    selectedProjectId,
    selectedFeatureId,
    activeRunContext,
    selectedTestId,
    setSelectedTestId,
    onMessage,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const draftedTests = useMemo(
    () =>
      selectedFeatureTests.filter(
        (testCase) => (testCase.planningStatus ?? 'drafted') === 'drafted',
      ),
    [selectedFeatureTests],
  );
  const approvedTests = useMemo(
    () =>
      selectedFeatureTests.filter(
        (testCase) => (testCase.planningStatus ?? 'drafted') === 'approved',
      ),
    [selectedFeatureTests],
  );

  const draftedTestCaseTitleError = draftedTestCaseForm.title.trim()
    ? null
    : 'Test title is required.';

  const resolvePreferredFeatureId = useCallback(
    (
      featuresTree: Record<string, Feature[]>,
      preferredProjectId: string,
      preferredFeatureId?: string,
    ): string => {
      if (preferredFeatureId) {
        const exists = Object.values(featuresTree).some((features) =>
          features.some((feature) => feature.id === preferredFeatureId),
        );
        if (exists) {
          return preferredFeatureId;
        }
      }

      const projectFeatures = featuresTree[preferredProjectId] ?? [];
      if (projectFeatures.length > 0) {
        return projectFeatures[0].id;
      }

      return Object.values(featuresTree).flat()[0]?.id ?? '';
    },
    [],
  );

  const refreshSidebar = useCallback(
    async (
      preferredProjectId: string = selectedProjectId,
      preferredFeatureId: string = selectedFeatureId,
      preferredTestId?: string,
    ): Promise<void> => {
      const rows = await refreshProjects(preferredProjectId);
      const nextProjectId =
        rows.length === 0
          ? ''
          : rows.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : rows[0].id;

      const featuresTree = await refreshFeaturesTree(
        rows,
        nextProjectId,
        preferredFeatureId || undefined,
      );
      const nextFeatureId = resolvePreferredFeatureId(
        featuresTree,
        nextProjectId,
        preferredFeatureId || undefined,
      );

      await refreshTestsTree(featuresTree, nextFeatureId, preferredTestId);
      await refreshActiveRunContext();
    },
    [
      refreshActiveRunContext,
      refreshFeaturesTree,
      refreshProjects,
      refreshTestsTree,
      resolvePreferredFeatureId,
      selectedFeatureId,
      selectedProjectId,
    ],
  );

  const refreshExecutionSummary = useCallback(
    async (featureId: string = selectedFeatureId): Promise<void> => {
      if (!featureId) {
        setExecutionSummary(null);
        return;
      }

      try {
        const result = await window.qaApi.testExecutionSummaryByFeature(featureId);
        if (!result.ok) {
          onMessage(result.error.message);
          return;
        }

        setExecutionSummary(result.data);
      } catch (error) {
        onMessage(`Failed loading execution summary: ${toErrorMessage(error)}`);
      }
    },
    [onMessage, selectedFeatureId],
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
    setSelectedDraftedTestIds([]);
  }, [selectedFeatureId]);

  useEffect(() => {
    if (!selectedFeatureId) {
      setFeaturePhase('planning');
      setExecutionFilter('all');
      setExecutionSummary(null);
      return;
    }

    void refreshExecutionSummary(selectedFeatureId);
  }, [refreshExecutionSummary, selectedFeatureId]);

  useEffect(() => {
    if (!selectedFeatureId) {
      return;
    }

    void refreshExecutionSummary(selectedFeatureId);
  }, [activeRunContext?.runId, refreshExecutionSummary, selectedFeatureId]);

  useEffect(() => {
    const draftedIdSet = new Set(draftedTests.map((testCase) => testCase.id));
    setSelectedDraftedTestIds((previous) =>
      previous.filter((testCaseId) => draftedIdSet.has(testCaseId)),
    );
  }, [draftedTests]);

  useEffect(() => {
    if (!selectedFeature) {
      return;
    }

    const isFeatureFormEmpty =
      featureForm.id.length === 0 &&
      featureForm.title.trim().length === 0 &&
      featureForm.acceptanceCriteria.trim().length === 0 &&
      featureForm.requirements.trim().length === 0 &&
      featureForm.notes.trim().length === 0;

    if (
      featureFormMode === 'create' &&
      featureForm.id !== selectedFeature.id &&
      isFeatureFormEmpty
    ) {
      beginEditSelectedFeature(selectedFeature.id);
      return;
    }

    lastSavedFeatureSignatureRef.current = buildFeatureSignature(
      selectedFeature.projectId,
      selectedFeature.id,
      selectedFeature.title,
      selectedFeature.acceptanceCriteria,
      selectedFeature.requirements ?? '',
      selectedFeature.notes ?? '',
    );
  }, [
    beginEditSelectedFeature,
    featureForm.acceptanceCriteria,
    featureForm.id,
    featureForm.notes,
    featureForm.requirements,
    featureForm.title,
    featureFormMode,
    selectedFeature,
  ]);

  useEffect(() => {
    const hasUserInput =
      featureForm.id.length > 0 ||
      featureForm.title.trim().length > 0 ||
      featureForm.acceptanceCriteria.trim().length > 0 ||
      featureForm.requirements.trim().length > 0 ||
      featureForm.notes.trim().length > 0;

    if (!selectedProjectId || !hasUserInput) {
      setFeatureAutoSaveStatus('saved');
      setFeatureAutoSaveMessage('Saved');
      return;
    }

    if (!canSaveFeature) {
      setFeatureAutoSaveStatus('saved');
      setFeatureAutoSaveMessage('Fill required fields to autosave.');
      return;
    }

    const currentSignature = buildFeatureSignature(
      selectedProjectId,
      featureForm.id,
      featureForm.title,
      featureForm.acceptanceCriteria,
      featureForm.requirements,
      featureForm.notes,
    );

    if (currentSignature === lastSavedFeatureSignatureRef.current) {
      setFeatureAutoSaveStatus('saved');
      if (featureAutoSaveMessage !== 'Fill required fields to autosave.') {
        setFeatureAutoSaveMessage('Saved');
      }
      return;
    }

    const currentAutoSaveVersion = featureAutoSaveVersion.current + 1;
    featureAutoSaveVersion.current = currentAutoSaveVersion;
    setFeatureAutoSaveStatus('saving');
    setFeatureAutoSaveMessage('Saving...');

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const isCreateMode = featureFormMode === 'create';
        const result = isCreateMode ? await createFeature() : await updateSelectedFeature();

        if (currentAutoSaveVersion !== featureAutoSaveVersion.current) {
          return;
        }

        if (!result) {
          setFeatureAutoSaveStatus('error');
          setFeatureAutoSaveMessage('Autosave failed.');
          return;
        }

        if (isCreateMode) {
          await refreshSidebar(result.projectId, result.id);
        }

        lastSavedFeatureSignatureRef.current = buildFeatureSignature(
          result.projectId,
          result.id,
          result.title,
          result.acceptanceCriteria,
          result.requirements ?? '',
          result.notes ?? '',
        );
        setFeatureAutoSaveStatus('saved');
        setFeatureAutoSaveMessage(
          `Saved at ${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        );
      })();
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canSaveFeature,
    createFeature,
    featureAutoSaveMessage,
    featureForm.acceptanceCriteria,
    featureForm.id,
    featureForm.notes,
    featureForm.requirements,
    featureForm.title,
    featureFormMode,
    refreshSidebar,
    selectedProjectId,
    updateSelectedFeature,
  ]);

  const hasAtLeastOneProject = projects.length > 0;

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
      setFeaturePhase('planning');
    },
    [selectProject, setSelectedProjectId],
  );

  const handleSelectFeature = useCallback(
    (projectId: string, featureId: string): void => {
      setSelectedProjectId(projectId);
      setSelectedFeatureId(featureId);
      beginEditSelectedFeature(featureId);
      selectFeature(featureId);
      setFeaturePhase('planning');
    },
    [beginEditSelectedFeature, selectFeature, setSelectedFeatureId, setSelectedProjectId],
  );

  const handleSwitchFeaturePhase = useCallback(
    (phase: 'planning' | 'execution'): void => {
      if (phase === 'execution' && !selectedFeatureId) {
        onMessage('Save the feature first to open execution.');
        return;
      }

      setFeaturePhase(phase);
    },
    [onMessage, selectedFeatureId],
  );

  const handleOpenWorkspacePage = useCallback(
    (testCaseId: string): void => {
      const testCase = approvedTests.find((row) => row.id === testCaseId);
      if (!testCase) {
        onMessage('Approved test case not found.');
        return;
      }

      setSelectedTestId(testCaseId);
      setFeaturePhase('workspace');
    },
    [approvedTests, onMessage],
  );

  const handleResetWorkspaceForm = useCallback((): void => {
    if (!selectedTest) {
      beginCreateTest();
      return;
    }

    setTestForm((previous) => ({
      ...previous,
      id: selectedTest.id,
      title: selectedTest.title,
      testType: selectedTest.testType,
      priority: selectedTest.priority,
      isAiGenerated: selectedTest.isAiGenerated,
      isCodeEditingEnabled: false,
      activeView: 'steps',
    }));
  }, [beginCreateTest, selectedTest, setTestForm]);

  const handleDeleteSelectedWorkspaceTest = useCallback(async (): Promise<void> => {
    const deleted = await deleteSelectedTest(async () => {
      await refreshSidebar(selectedProjectId, selectedFeatureId);
      await refreshExecutionSummary(selectedFeatureId);
      setFeaturePhase('execution');
    });

    if (!deleted) {
      return;
    }
  }, [
    deleteSelectedTest,
    refreshExecutionSummary,
    refreshSidebar,
    selectedFeatureId,
    selectedProjectId,
  ]);

  const handleRunApprovedTestCase = useCallback(
    async (testCaseId: string): Promise<void> => {
      if (activeRunContext) {
        onMessage('A run is already active. Cancel it before starting another run.');
        return;
      }

      const target = executionSummary?.testCases.find((testCase) => testCase.id === testCaseId);
      if (!target) {
        onMessage('Approved test case not found.');
        return;
      }

      if (!target.hasSteps) {
        onMessage('Add steps first in the test-case workspace before running.');
        return;
      }

      setSelectedTestId(testCaseId);
      await startRun(testCaseId);
      await refreshExecutionSummary(selectedFeatureId);
    },
    [
      activeRunContext,
      executionSummary?.testCases,
      onMessage,
      refreshExecutionSummary,
      selectedFeatureId,
      startRun,
    ],
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

    await refreshSidebar(updated.id, selectedFeatureId, selectedTestId || undefined);
    onMessage('Project updated.');
  }, [onMessage, refreshSidebar, selectedFeatureId, selectedTestId, updateSelectedProject]);

  const handleDeleteProjectById = useCallback(
    async (projectId: string): Promise<void> => {
      await deleteSelectedProject(
        async () => {
          const shouldClearSelection = selectedProjectId === projectId;
          if (shouldClearSelection) {
            setSelectedFeatureId('');
            setSelectedTestId('');
            clearRunSelectionState();
            beginCreateFeature();
          }
          await refreshSidebar(shouldClearSelection ? '' : selectedProjectId);
        },
        projectId,
      );
    },
    [
      beginCreateFeature,
      clearRunSelectionState,
      deleteSelectedProject,
      refreshSidebar,
      selectedProjectId,
      setSelectedFeatureId,
    ],
  );

  const handleDeleteFeatureById = useCallback(
    async (featureId: string): Promise<void> => {
      await deleteSelectedFeature(async () => {
        const shouldClearSelection = selectedFeatureId === featureId;
        if (shouldClearSelection) {
          setSelectedTestId('');
          clearRunSelectionState();
          beginCreateFeature();
        }
        await refreshSidebar(
          selectedProjectId,
          shouldClearSelection ? '' : selectedFeatureId,
          shouldClearSelection ? undefined : selectedTestId || undefined,
        );
      }, featureId);
    },
    [
      beginCreateFeature,
      clearRunSelectionState,
      deleteSelectedFeature,
      refreshSidebar,
      selectedFeatureId,
      selectedProjectId,
      selectedTestId,
    ],
  );

  const resetDraftedTestCaseModal = useCallback((): void => {
    setDraftedTestCaseForm(DEFAULT_DRAFTED_TEST_CASE_FORM);
    setDraftedTestCaseModalMode('create');
    setIsDraftedTestCaseModalOpen(false);
  }, []);

  const handleOpenAddDraftedTestCaseModal = useCallback((): void => {
    if (!selectedFeatureId) {
      onMessage('Save the feature first before adding drafted test cases.');
      return;
    }

    setDraftedTestCaseModalMode('create');
    setDraftedTestCaseForm(DEFAULT_DRAFTED_TEST_CASE_FORM);
    setIsDraftedTestCaseModalOpen(true);
  }, [onMessage, selectedFeatureId]);

  const findSelectedFeatureTestCase = useCallback(
    (testCaseId: string): TestCase | undefined =>
      selectedFeatureTests.find((testCase) => testCase.id === testCaseId),
    [selectedFeatureTests],
  );

  const handleSubmitDraftedTestCase = useCallback(async (): Promise<void> => {
    if (!selectedFeatureId) {
      onMessage('Save the feature first before adding drafted test cases.');
      return;
    }

    if (draftedTestCaseTitleError) {
      onMessage(draftedTestCaseTitleError);
      return;
    }

    try {
      const result =
        draftedTestCaseModalMode === 'create'
          ? await window.qaApi.testCreate({
              featureId: selectedFeatureId,
              title: draftedTestCaseForm.title.trim(),
              testType: draftedTestCaseForm.testType,
              priority: draftedTestCaseForm.priority,
              planningStatus: 'drafted',
              isAiGenerated: false,
            })
          : await window.qaApi.testUpdate({
              id: draftedTestCaseForm.id,
              featureId: selectedFeatureId,
              title: draftedTestCaseForm.title.trim(),
              testType: draftedTestCaseForm.testType,
              priority: draftedTestCaseForm.priority,
              planningStatus:
                findSelectedFeatureTestCase(draftedTestCaseForm.id)?.planningStatus ?? 'drafted',
              isAiGenerated: false,
            });

      if (!result.ok) {
        onMessage(result.error.message);
        return;
      }

      resetDraftedTestCaseModal();
      await refreshSidebar(selectedProjectId, selectedFeatureId, result.data.id);
      await refreshExecutionSummary(selectedFeatureId);
      onMessage(
        draftedTestCaseModalMode === 'create'
          ? 'Drafted test case created.'
          : 'Drafted test case updated.',
      );
    } catch (error) {
      onMessage(`Saving drafted test case failed: ${toErrorMessage(error)}`);
    }
  }, [
    draftedTestCaseForm.id,
    draftedTestCaseForm.priority,
    draftedTestCaseForm.testType,
    draftedTestCaseForm.title,
    draftedTestCaseModalMode,
    draftedTestCaseTitleError,
    onMessage,
    refreshExecutionSummary,
    refreshSidebar,
    resetDraftedTestCaseModal,
    findSelectedFeatureTestCase,
    selectedFeatureId,
    selectedProjectId,
  ]);

  const handleGenerateAiScenarios = useCallback(async (): Promise<void> => {
    if (!selectedFeatureId) {
      onMessage('Save the feature first before generating AI scenarios.');
      return;
    }

    if (isGeneratingAiScenarios) {
      return;
    }

    setIsGeneratingAiScenarios(true);
    try {
      const result = await window.qaApi.generateFeatureScenarios({ featureId: selectedFeatureId });
      if (!result.ok) {
        onMessage(result.error.message);
        return;
      }

      if (!result.data.success) {
        onMessage(result.data.message);
        return;
      }

      await refreshSidebar(selectedProjectId, selectedFeatureId);
      await refreshExecutionSummary(selectedFeatureId);
      const count = result.data.scenarios.length;
      onMessage(
        count === 1 ? '1 AI-generated scenario added' : `${count} AI-generated scenarios added`,
      );
    } catch (error) {
      onMessage(`AI scenario generation failed: ${toErrorMessage(error)}`);
    } finally {
      setIsGeneratingAiScenarios(false);
    }
  }, [
    isGeneratingAiScenarios,
    onMessage,
    refreshExecutionSummary,
    refreshSidebar,
    selectedFeatureId,
    selectedProjectId,
  ]);

  const handleToggleDraftedSelection = useCallback(
    (testCaseId: string, checked: boolean): void => {
      setSelectedDraftedTestIds((previous) => {
        if (checked) {
          if (previous.includes(testCaseId)) {
            return previous;
          }
          return [...previous, testCaseId];
        }
        return previous.filter((id) => id !== testCaseId);
      });
    },
    [],
  );

  const updateTestCasePlanningStatus = useCallback(
    async (
      testCaseId: string,
      planningStatus: TestPlanningStatus,
      successMessage: string,
    ): Promise<void> => {
      const testCase = findSelectedFeatureTestCase(testCaseId);
      if (!testCase) {
        onMessage('Test case not found.');
        return;
      }

      try {
        const result = await window.qaApi.testUpdate({
          id: testCase.id,
          featureId: testCase.featureId,
          title: testCase.title,
          testType: testCase.testType,
          priority: testCase.priority,
          planningStatus,
          isAiGenerated: testCase.isAiGenerated,
        });

        if (!result.ok) {
          onMessage(mapTestPlanningStatusUpdateError(result.error.message));
          return;
        }

        setSelectedDraftedTestIds((previous) =>
          previous.filter((selectedTestId) => selectedTestId !== testCaseId),
        );
        await refreshSidebar(selectedProjectId, selectedFeatureId, result.data.id);
        await refreshExecutionSummary(selectedFeatureId);
        onMessage(successMessage);
      } catch (error) {
        onMessage(`Updating test case status failed: ${toErrorMessage(error)}`);
      }
    },
    [
      findSelectedFeatureTestCase,
      onMessage,
      refreshExecutionSummary,
      refreshSidebar,
      selectedFeatureId,
      selectedProjectId,
    ],
  );

  const handleApproveDraftedTestCase = useCallback(
    async (testCaseId: string): Promise<void> => {
      await updateTestCasePlanningStatus(
        testCaseId,
        'approved',
        'Test case moved to approved.',
      );
    },
    [updateTestCasePlanningStatus],
  );

  const handleApproveSelectedDraftedTests = useCallback(async (): Promise<void> => {
    if (selectedDraftedTestIds.length === 0) {
      onMessage('Select drafted test cases first.');
      return;
    }

    const selectedCases = draftedTests.filter((testCase) =>
      selectedDraftedTestIds.includes(testCase.id),
    );
    if (selectedCases.length === 0) {
      onMessage('Selected drafted test cases are no longer available.');
      setSelectedDraftedTestIds([]);
      return;
    }

    try {
      const responses = await Promise.all(
        selectedCases.map((testCase) =>
          window.qaApi.testUpdate({
            id: testCase.id,
            featureId: testCase.featureId,
            title: testCase.title,
            testType: testCase.testType,
            priority: testCase.priority,
            planningStatus: 'approved',
            isAiGenerated: testCase.isAiGenerated,
          }),
        ),
      );

      const failed = responses.find((response) => !response.ok);
      if (failed && !failed.ok) {
        onMessage(mapTestPlanningStatusUpdateError(failed.error.message));
        return;
      }

      setSelectedDraftedTestIds([]);
      await refreshSidebar(selectedProjectId, selectedFeatureId);
      await refreshExecutionSummary(selectedFeatureId);
      onMessage(
        selectedCases.length === 1
          ? '1 test case moved to approved.'
          : `${selectedCases.length} test cases moved to approved.`,
      );
    } catch (error) {
      onMessage(`Bulk approve failed: ${toErrorMessage(error)}`);
    }
  }, [
    draftedTests,
    onMessage,
    refreshExecutionSummary,
    refreshSidebar,
    selectedDraftedTestIds,
    selectedFeatureId,
    selectedProjectId,
  ]);

  const handleMoveBackApprovedTestCase = useCallback(
    async (testCaseId: string): Promise<void> => {
      await updateTestCasePlanningStatus(
        testCaseId,
        'drafted',
        'Test case moved back to drafted.',
      );
    },
    [updateTestCasePlanningStatus],
  );

  const handleDeleteTestCase = useCallback(
    async (testCaseId: string): Promise<void> => {
      if (activeRunContext?.testCaseId === testCaseId) {
        onMessage('Cannot delete this test case while it is running.');
        return;
      }

      if (!window.confirm('Delete this test case?')) {
        return;
      }

      try {
        const result = await window.qaApi.testDelete(testCaseId);
        if (!result.ok) {
          onMessage(result.error.message);
          return;
        }

        if (selectedTestId === testCaseId) {
          setSelectedTestId('');
          clearRunSelectionState();
        }
        setSelectedDraftedTestIds((previous) =>
          previous.filter((selectedId) => selectedId !== testCaseId),
        );

        await refreshSidebar(selectedProjectId, selectedFeatureId);
        await refreshExecutionSummary(selectedFeatureId);
        onMessage(result.data ? 'Test case deleted.' : 'Test case was already deleted.');
      } catch (error) {
        onMessage(`Delete test case failed: ${toErrorMessage(error)}`);
      }
    },
    [
      activeRunContext?.testCaseId,
      clearRunSelectionState,
      onMessage,
      refreshExecutionSummary,
      refreshSidebar,
      selectedFeatureId,
      selectedProjectId,
      selectedTestId,
    ],
  );

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

  if (activeScreen === 'install') {
    return (
      <main className="h-screen w-screen bg-background">
        <div className="h-full w-full overflow-hidden bg-background">
          <BrowserInstallScreen
            browserStates={browserStates}
            browserInstallProgress={browserInstallProgress}
            hasInstalledBrowser={hasInstalledBrowser}
            onBackToWorkspace={
              isBrowserInstallScreenOpen
                ? () => setIsBrowserInstallScreenOpen(false)
                : undefined
            }
            onInstallBrowser={(nextBrowser) => {
              void installBrowser(nextBrowser);
            }}
          />
        </div>
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

  return (
    <main className="h-screen w-screen bg-background">
      <div className={appShellClass}>
        <SidebarProjectsPanel
          projects={projects}
          featuresByProject={featuresByProject}
          selectedProjectId={selectedProjectId}
          selectedFeatureId={selectedFeatureId}
          appVersion={appVersion}
          isProjectDeleteBlocked={isProjectDeleteBlocked}
          onSelectProject={handleSelectProject}
          onSelectFeature={handleSelectFeature}
          onBeginCreateProject={beginCreateProject}
          onCreateFeatureForProject={(projectId) => {
            setSelectedProjectId(projectId);
            beginCreateFeature();
            setFeaturePhase('planning');
            setSelectedDraftedTestIds([]);
            lastSavedFeatureSignatureRef.current = '';
            setFeatureAutoSaveStatus('saved');
            setFeatureAutoSaveMessage('Saved');
          }}
          onBeginEditProject={(projectId) => beginEditSelectedProject(projectId)}
          onDeleteProject={(projectId) => {
            void handleDeleteProjectById(projectId);
          }}
          onBeginEditFeature={(featureId) => beginEditSelectedFeature(featureId)}
          onDeleteFeature={(featureId) => {
            void handleDeleteFeatureById(featureId);
          }}
          onOpenStepDocs={() => {
            void handleOpenStepDocs();
          }}
          onOpenBrowserInstall={() => {
            setIsBrowserInstallScreenOpen(true);
          }}
        />

        <section className="min-w-0 overflow-y-auto bg-transparent px-8 py-6">
          {activeScreen === 'empty' ? (
            <ProjectSetupScreen onBeginCreateProject={beginCreateProject} />
          ) : featurePhase === 'workspace' ? (
            <div className="flex min-h-full flex-col gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span>{selectedProject?.name ?? 'Unselected'}</span>
                  <span>/</span>
                  <button
                    type="button"
                    className="rounded-sm px-1 py-0.5 text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70"
                    onClick={() => setFeaturePhase('execution')}
                    disabled={!selectedFeatureId}
                  >
                    {selectedFeature?.title ?? 'Unselected'}
                  </button>
                  <span>/</span>
                  <span className="text-foreground">{testForm.title || 'Untitled test case'}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      ref={workspaceTitleInputRef}
                      aria-label="Workspace test case title"
                      className="min-w-[320px] flex-1 border-0 bg-transparent px-0 py-0 text-[28px] font-semibold leading-none text-foreground outline-none"
                      value={testForm.title}
                      onChange={(event) =>
                        setTestForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Login with valid credentials"
                    />
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-secondary-foreground"
                      aria-label="Edit test case title"
                      onClick={() => workspaceTitleInputRef.current?.focus()}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.42L18.38 3.3a1 1 0 00-1.42 0l-1.83 1.83l3.75 3.75L20.7 7.04z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5 text-[12px] text-secondary-foreground">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M4 6h16M4 12h16M4 18h16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      <select
                        className="border-0 bg-transparent text-[12px] text-secondary-foreground outline-none"
                        value={browser}
                        onChange={(event) => setBrowser(event.target.value as BrowserName)}
                        aria-label="Browser selector"
                      >
                        <option value="chromium">chromium</option>
                        <option value="firefox">firefox</option>
                        <option value="webkit">webkit</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => {
                        void startRun();
                      }}
                      disabled={!selectedTestId || !selectedTestHasSteps || Boolean(activeRunId)}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M8 6l10 6-10 6z" fill="currentColor" />
                      </svg>
                      Run
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center rounded-sm border border-success/40 bg-success/12 px-2 py-0.5 font-semibold text-success">
                    {testForm.testType === 'positive'
                      ? 'E2E Test'
                      : testForm.testType === 'negative'
                        ? 'Negative Test'
                        : 'Edge Test'}
                  </span>
                  <span className="inline-flex items-center rounded-sm border border-warning/40 bg-warning/12 px-2 py-0.5 font-semibold text-warning">
                    {testForm.priority === 'high' ? 'P1 - Critical' : testForm.priority === 'medium' ? 'P2 - Medium' : 'P3 - Low'}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    last edited{' '}
                    {selectedTest?.updatedAt ? formatRelativeTimestamp(selectedTest.updatedAt) : 'just now'}
                  </span>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_392px]">
                <TestCaseEditorPanel
                  testCasePanelTitle="Steps Editor"
                  testCasePanelDescription={
                    selectedTest
                      ? 'Edit natural-language steps and code for this scenario.'
                      : 'Select a test case from Execution page to edit.'
                  }
                  hasAtLeastOneTestCase={Boolean(selectedTest)}
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
                  canStartRun={Boolean(selectedTestId) && selectedTestHasSteps && !activeRunId}
                  setEditorView={setEditorView}
                  onEnableCodeEditing={enableCodeEditing}
                  onCodeChange={updateCodeDraft}
                  onRestoreGeneratedCode={restoreGeneratedCode}
                  onBeginCreateTest={handleResetWorkspaceForm}
                  onGenerateSteps={() => {
                    void generateSteps();
                  }}
                  onDeleteSelectedTest={() => {
                    void handleDeleteSelectedWorkspaceTest();
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
                  canRerun={Boolean(selectedTestId)}
                  onGenerateBugReport={() => {
                    onMessage('Bug report generation is not available in this workspace view yet.');
                  }}
                  isGeneratingBugReport={false}
                  canGenerateBugReport={false}
                />
              </div>
            </div>
          ) : featurePhase === 'execution' ? (
            <FeatureExecutionPage
              hasSelectedProject={Boolean(selectedProjectId)}
              selectedProjectName={selectedProject?.name ?? 'Unselected'}
              featureTitle={selectedFeature?.title ?? featureForm.title}
              summary={executionSummary}
              activeFilter={executionFilter}
              onChangeFilter={setExecutionFilter}
              onSwitchPhase={handleSwitchFeaturePhase}
              canOpenExecution={Boolean(selectedFeatureId)}
              onEditTestCase={(testCaseId) => {
                handleOpenWorkspacePage(testCaseId);
              }}
              onRunTestCase={(testCaseId) => {
                void handleRunApprovedTestCase(testCaseId);
              }}
              onStopActiveRun={() => {
                void cancelRun();
              }}
              runBlocked={Boolean(activeRunContext)}
            />
          ) : (
            <FeaturePlanningPage
              hasSelectedProject={Boolean(selectedProjectId)}
              selectedProjectName={selectedProject?.name ?? 'Unselected'}
              featureForm={featureForm}
              setFeatureForm={setFeatureForm}
              featureFormMode={featureFormMode}
              featureTitleError={featureTitleError}
              featureAcceptanceCriteriaError={featureAcceptanceCriteriaError}
              featureAutoSaveStatus={featureAutoSaveStatus}
              featureAutoSaveMessage={featureAutoSaveMessage}
              onSwitchPhase={handleSwitchFeaturePhase}
              canOpenExecution={Boolean(selectedFeatureId)}
              draftedTests={draftedTests}
              approvedTests={approvedTests}
              selectedDraftedTestIds={selectedDraftedTestIds}
              canManageDraftedTests={Boolean(selectedFeatureId)}
              isTestDeleteBlocked={(testCaseId) => activeRunContext?.testCaseId === testCaseId}
              onAddTestCase={handleOpenAddDraftedTestCaseModal}
              onGenerateAiScenarios={() => {
                void handleGenerateAiScenarios();
              }}
              isGeneratingAiScenarios={isGeneratingAiScenarios}
              onToggleDraftedSelection={handleToggleDraftedSelection}
              onApproveDraftedTestCase={(testCaseId) => {
                void handleApproveDraftedTestCase(testCaseId);
              }}
              onApproveSelectedDraftedTests={() => {
                void handleApproveSelectedDraftedTests();
              }}
              onMoveBackApprovedTestCase={(testCaseId) => {
                void handleMoveBackApprovedTestCase(testCaseId);
              }}
              onDeleteTestCase={(testCaseId) => {
                void handleDeleteTestCase(testCaseId);
              }}
            />
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

      {isDraftedTestCaseModalOpen ? (
        <DraftedTestCaseModal
          mode={draftedTestCaseModalMode}
          form={draftedTestCaseForm}
          setForm={setDraftedTestCaseForm}
          titleError={draftedTestCaseTitleError}
          onClose={resetDraftedTestCaseModal}
          onSubmit={() => {
            void handleSubmitDraftedTestCase();
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
