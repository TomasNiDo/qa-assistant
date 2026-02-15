import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer, toast } from 'react-toastify';
import type {
  AppConfig,
  BrowserInstallPhase,
  BrowserInstallState,
  BrowserInstallUpdate,
  BrowserName,
  GeneratedBugReport,
  Project,
  Run,
  RunUpdateEvent,
  StepParseResult,
  StepResult,
  TestCase,
} from '@shared/types';

interface ProjectFormState {
  id: string;
  name: string;
  baseUrl: string;
  envLabel: string;
}

interface TestFormState {
  id: string;
  title: string;
  stepsText: string;
}

interface BrowserInstallProgressState {
  phase: BrowserInstallPhase;
  progress: number | null;
  message: string;
  timestamp: string;
}

type ProjectFormMode = 'create' | 'edit';

const DEFAULT_PROJECT_FORM: ProjectFormState = {
  id: '',
  name: 'New Project',
  baseUrl: 'https://example.com',
  envLabel: 'local',
};

const DEFAULT_TEST_FORM: TestFormState = {
  id: '',
  title: '',
  stepsText: 'Click "Login"',
};

const THEME_STORAGE_KEY = 'qa-assistant-theme';

export function App(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [testCasesByProject, setTestCasesByProject] = useState<Record<string, TestCase[]>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');

  const [projectForm, setProjectForm] = useState<ProjectFormState>(DEFAULT_PROJECT_FORM);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>('create');
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);

  const [isTestEditing, setIsTestEditing] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>(DEFAULT_TEST_FORM);
  const [stepParsePreview, setStepParsePreview] = useState<StepParseResult[]>([]);
  const [isValidatingSteps, setIsValidatingSteps] = useState(false);

  const [browser, setBrowser] = useState<BrowserName>('chromium');
  const [browserStates, setBrowserStates] = useState<BrowserInstallState[]>([]);
  const [browserInstallProgress, setBrowserInstallProgress] = useState<
    Partial<Record<BrowserName, BrowserInstallProgressState>>
  >({});
  const [isBrowserStatesLoaded, setIsBrowserStatesLoaded] = useState(false);
  const [activeRunId, setActiveRunId] = useState('');
  const [bugReport, setBugReport] = useState<GeneratedBugReport | null>(null);
  const [bugReportDraft, setBugReportDraft] = useState('');

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const stepValidationVersion = useRef(0);
  const testFormLoadVersion = useRef(0);
  const hasInitializedSidebar = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectTests = useMemo(
    () => (selectedProjectId ? testCasesByProject[selectedProjectId] ?? [] : []),
    [selectedProjectId, testCasesByProject],
  );

  const selectedTest = useMemo(
    () => selectedProjectTests.find((testCase) => testCase.id === selectedTestId) ?? null,
    [selectedProjectTests, selectedTestId],
  );

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const selectedBrowserState = useMemo(
    () => browserStates.find((state) => state.browser === browser) ?? null,
    [browser, browserStates],
  );

  const parsedSteps = useMemo(() => parseStepLines(testForm.stepsText), [testForm.stepsText]);

  const refreshTestsTree = useCallback(
    async (projectRows: Project[], preferredProjectId: string, preferredTestId?: string): Promise<void> => {
      if (projectRows.length === 0) {
        setTestCasesByProject({});
        setSelectedTestId('');
        return;
      }

      const nextTree: Record<string, TestCase[]> = {};

      for (const project of projectRows) {
        let result: Awaited<ReturnType<typeof window.qaApi.testList>>;
        try {
          result = await window.qaApi.testList(project.id);
        } catch (error) {
          setMessage(`Failed loading test cases for ${project.name}: ${toErrorMessage(error)}`);
          nextTree[project.id] = [];
          continue;
        }

        if (!result.ok) {
          setMessage(result.error.message);
          nextTree[project.id] = [];
          continue;
        }

        nextTree[project.id] = result.data;
      }

      setTestCasesByProject(nextTree);

      if (preferredTestId) {
        const exists = Object.values(nextTree).some((tests) => tests.some((test) => test.id === preferredTestId));
        if (exists) {
          setSelectedTestId(preferredTestId);
          return;
        }
      }

      const selectedStillExists = Object.values(nextTree).some((tests) =>
        tests.some((test) => test.id === selectedTestId),
      );
      if (selectedStillExists) {
        return;
      }

      const preferredTests = nextTree[preferredProjectId] ?? [];
      if (preferredTests.length > 0) {
        setSelectedTestId(preferredTests[0].id);
        return;
      }

      const firstTest = projectRows.flatMap((project) => nextTree[project.id] ?? [])[0];
      setSelectedTestId(firstTest?.id ?? '');
    },
    [selectedTestId],
  );

  const refreshSidebar = useCallback(
    async (preferredProjectId: string = selectedProjectId, preferredTestId?: string): Promise<void> => {
      let result: Awaited<ReturnType<typeof window.qaApi.projectList>>;
      try {
        result = await window.qaApi.projectList();
      } catch (error) {
        setMessage(`Failed loading projects: ${toErrorMessage(error)}`);
        return;
      }

      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      const rows = result.data;
      setProjects(rows);

      let nextProjectId = preferredProjectId;
      if (rows.length === 0) {
        nextProjectId = '';
      } else if (!rows.some((project) => project.id === preferredProjectId)) {
        nextProjectId = rows[0].id;
      }

      setSelectedProjectId(nextProjectId);
      await refreshTestsTree(rows, nextProjectId, preferredTestId);
    },
    [refreshTestsTree, selectedProjectId],
  );

  const refreshRuns = useCallback(async () => {
    if (!selectedTestId) {
      setRuns([]);
      setSelectedRunId('');
      return;
    }

    const result = await window.qaApi.runHistory(selectedTestId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    const orderedRuns = [...result.data].sort(
      (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
    );

    setRuns(orderedRuns);
    if (orderedRuns.length === 0) {
      setSelectedRunId('');
      return;
    }

    if (!orderedRuns.find((run) => run.id === selectedRunId)) {
      setSelectedRunId(orderedRuns[orderedRuns.length - 1].id);
    }
  }, [selectedRunId, selectedTestId]);

  const refreshStepResults = useCallback(async () => {
    if (!selectedRunId) {
      setStepResults([]);
      return;
    }

    const result = await window.qaApi.stepResults(selectedRunId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setStepResults(result.data);
  }, [selectedRunId]);

  const refreshBrowserStates = useCallback(async () => {
    try {
      const result = await window.qaApi.runBrowserStatus();
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      setBrowserStates(result.data);
    } finally {
      setIsBrowserStatesLoaded(true);
    }
  }, []);

  const loadSelectedTestIntoForm = useCallback(async () => {
    const currentLoadVersion = testFormLoadVersion.current + 1;
    testFormLoadVersion.current = currentLoadVersion;

    if (!selectedTest) {
      setIsTestEditing(false);
      setTestForm(DEFAULT_TEST_FORM);
      return;
    }

    const stepRowsResult = await window.qaApi.stepList(selectedTest.id);
    if (currentLoadVersion !== testFormLoadVersion.current) {
      return;
    }

    if (!stepRowsResult.ok) {
      setMessage(stepRowsResult.error.message);
      return;
    }

    setIsTestEditing(true);
    setTestForm({
      id: selectedTest.id,
      title: selectedTest.title,
      stepsText: stepRowsResult.data.map((step) => step.rawText).join('\n'),
    });
  }, [selectedTest]);

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
  }, [isProjectFormOpen, projectFormMode, selectedProjectId, selectedProject]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    void refreshStepResults();
  }, [refreshStepResults]);

  useEffect(() => {
    void refreshBrowserStates();
  }, [refreshBrowserStates]);

  useEffect(() => {
    void loadSelectedTestIntoForm();
  }, [loadSelectedTestIntoForm]);

  useEffect(() => {
    const version = stepValidationVersion.current + 1;
    stepValidationVersion.current = version;
    setIsValidatingSteps(true);

    if (parsedSteps.length === 0) {
      setStepParsePreview([]);
      setIsValidatingSteps(false);
      return;
    }

    void (async () => {
      const results: StepParseResult[] = [];

      for (const stepText of parsedSteps) {
        const rawStep = stepText.trim();
        if (!rawStep) {
          results.push({ ok: false, error: 'Step cannot be empty.' });
          continue;
        }

        const parsed = await window.qaApi.stepParse(rawStep);
        if (!parsed.ok) {
          results.push({ ok: false, error: parsed.error.message });
          continue;
        }

        results.push(parsed.data);
      }

      if (version !== stepValidationVersion.current) {
        return;
      }

      setStepParsePreview(results);
      setIsValidatingSteps(false);
    })();
  }, [parsedSteps]);

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const status = await window.qaApi.runStatus(activeRunId);
      if (!status.ok || !status.data) {
        return;
      }

      if (status.data.status === 'running') {
        await refreshRuns();
        return;
      }

      window.clearInterval(intervalId);
      setActiveRunId('');
      await refreshRuns();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRunId, refreshRuns]);

  const handleRunUpdate = useCallback(
    (update: RunUpdateEvent): void => {
      if (update.type === 'run-started') {
        setSelectedRunId(update.runId);
        void refreshRuns();
        void refreshStepResults();
        return;
      }

      if (update.type === 'step-started' || update.type === 'step-finished') {
        if (update.runId === selectedRunId || update.runId === activeRunId) {
          void refreshStepResults();
        }
        void refreshRuns();
        return;
      }

      setActiveRunId((current) => (current === update.runId ? '' : current));
      if (update.runId === selectedRunId || update.runId === activeRunId) {
        void refreshStepResults();
      }
      void refreshRuns();
      void refreshBrowserStates();

      if (update.message) {
        setMessage(update.message);
      }
    },
    [activeRunId, refreshBrowserStates, refreshRuns, refreshStepResults, selectedRunId],
  );

  useEffect(() => {
    const unsubscribe = window.qaApi.onRunUpdate((update) => {
      handleRunUpdate(update);
    });

    return () => {
      unsubscribe();
    };
  }, [handleRunUpdate]);

  const handleBrowserInstallUpdate = useCallback((update: BrowserInstallUpdate): void => {
    setBrowserInstallProgress((previous) => ({
      ...previous,
      [update.browser]: {
        phase: update.phase,
        progress: update.progress,
        message: update.message,
        timestamp: update.timestamp,
      },
    }));

    if (update.phase === 'completed' || update.phase === 'failed') {
      void refreshBrowserStates();
    }
  }, [refreshBrowserStates]);

  useEffect(() => {
    const unsubscribe = window.qaApi.onBrowserInstallUpdate((update) => {
      handleBrowserInstallUpdate(update);
    });

    return () => {
      unsubscribe();
    };
  }, [handleBrowserInstallUpdate]);

  const loadConfig = useCallback(async (): Promise<void> => {
    const result = await window.qaApi.configGet();
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setAppConfig(result.data);
    setBrowser(result.data.defaultBrowser);
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      root.classList.toggle('dark', storedTheme === 'dark');
      setTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nextTheme: 'light' | 'dark' = prefersDark ? 'dark' : 'light';
    root.classList.toggle('dark', prefersDark);
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!message) {
      return;
    }

    toast(message);
    setMessage('');
  }, [message]);

  const projectNameError = projectForm.name.trim() ? null : 'Project name is required.';
  const projectBaseUrlError = validateBaseUrl(projectForm.baseUrl);
  const canSaveProject = !projectNameError && !projectBaseUrlError;

  const testTitleError = testForm.title.trim() ? null : 'Test title is required.';
  const testStepsErrors = parsedSteps.map((stepText, index) => {
    const rawStep = stepText.trim();
    if (!rawStep) {
      return 'Step cannot be empty.';
    }

    const parsed = stepParsePreview[index];
    if (!parsed) {
      return isValidatingSteps ? 'Validating step...' : 'Validation unavailable.';
    }

    return parsed.ok ? null : parsed.error;
  });

  const hasStepErrors = testStepsErrors.some(Boolean) || parsedSteps.length === 0;
  const canSaveTestCase =
    Boolean(selectedProjectId) &&
    !testTitleError &&
    !hasStepErrors &&
    !isValidatingSteps;

  function selectProject(projectId: string): void {
    setSelectedProjectId(projectId);

    const testsForProject = testCasesByProject[projectId] ?? [];
    if (!testsForProject.some((testCase) => testCase.id === selectedTestId)) {
      setSelectedTestId(testsForProject[0]?.id ?? '');
    }
  }

  function selectTest(projectId: string, testId: string): void {
    setSelectedProjectId(projectId);
    setSelectedTestId(testId);
  }

  function beginCreateProject(): void {
    setProjectFormMode('create');
    setProjectForm(DEFAULT_PROJECT_FORM);
    setIsProjectFormOpen(true);
  }

  function beginEditSelectedProject(): void {
    if (!selectedProject) {
      setMessage('Select a project first.');
      return;
    }

    setProjectFormMode('edit');
    setProjectForm({
      id: selectedProject.id,
      name: selectedProject.name,
      baseUrl: selectedProject.baseUrl,
      envLabel: selectedProject.envLabel,
    });
    setIsProjectFormOpen(true);
  }

  function closeProjectForm(): void {
    setIsProjectFormOpen(false);
    setProjectFormMode('create');
  }

  async function createProject(): Promise<void> {
    if (!canSaveProject) {
      setMessage(projectNameError ?? projectBaseUrlError ?? 'Fix project validation errors.');
      return;
    }

    const payload = {
      name: projectForm.name.trim(),
      baseUrl: projectForm.baseUrl.trim(),
      envLabel: projectForm.envLabel.trim() || 'local',
      metadata: {},
    };

    let result: Awaited<ReturnType<typeof window.qaApi.projectCreate>>;
    try {
      result = await window.qaApi.projectCreate(payload);
    } catch (error) {
      setMessage(`Create project failed: ${toErrorMessage(error)}`);
      return;
    }

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setProjects((previous) => {
      const exists = previous.some((project) => project.id === result.data.id);
      if (exists) {
        return previous;
      }

      return [result.data, ...previous];
    });
    setTestCasesByProject((previous) => ({
      ...previous,
      [result.data.id]: previous[result.data.id] ?? [],
    }));
    setSelectedProjectId(result.data.id);
    setSelectedTestId('');

    setProjectForm({
      id: result.data.id,
      name: result.data.name,
      baseUrl: result.data.baseUrl,
      envLabel: result.data.envLabel,
    });
    setIsProjectFormOpen(false);
    setProjectFormMode('create');

    try {
      await refreshSidebar(result.data.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      setMessage(`Project created, but sidebar refresh failed: ${reason}`);
      return;
    }

    setMessage('Project created.');
  }

  async function updateSelectedProject(): Promise<void> {
    if (!selectedProject) {
      setMessage('Select a project first.');
      return;
    }

    if (!canSaveProject) {
      setMessage(projectNameError ?? projectBaseUrlError ?? 'Fix project validation errors.');
      return;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.projectUpdate>>;
    try {
      result = await window.qaApi.projectUpdate({
        id: selectedProject.id,
        name: projectForm.name.trim(),
        baseUrl: projectForm.baseUrl.trim(),
        envLabel: projectForm.envLabel.trim() || 'local',
        metadata: {},
      });
    } catch (error) {
      setMessage(`Update project failed: ${toErrorMessage(error)}`);
      return;
    }

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setProjectForm({
      id: result.data.id,
      name: result.data.name,
      baseUrl: result.data.baseUrl,
      envLabel: result.data.envLabel,
    });
    setIsProjectFormOpen(false);
    setProjectFormMode('create');
    await refreshSidebar(result.data.id, selectedTestId || undefined);
    setMessage('Project updated.');
  }

  async function deleteSelectedProject(): Promise<void> {
    if (!selectedProjectId) {
      setMessage('Select a project first.');
      return;
    }

    if (!window.confirm('Delete this project and all related tests/runs?')) {
      return;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.projectDelete>>;
    try {
      result = await window.qaApi.projectDelete(selectedProjectId);
    } catch (error) {
      setMessage(`Delete project failed: ${toErrorMessage(error)}`);
      return;
    }
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    beginCreateProject();
    setIsProjectFormOpen(false);
    setSelectedRunId('');
    setBugReport(null);
    setBugReportDraft('');
    await refreshSidebar();
    setMessage(result.data ? 'Project deleted.' : 'Project was already deleted.');
  }

  function beginCreateTest(): void {
    testFormLoadVersion.current += 1;
    setSelectedTestId('');
    setIsTestEditing(false);
    setTestForm(DEFAULT_TEST_FORM);
  }

  async function saveTestCase(): Promise<void> {
    if (!selectedProjectId) {
      setMessage('Select a project first.');
      return;
    }

    if (!canSaveTestCase) {
      setMessage(testTitleError ?? 'Fix invalid steps before saving.');
      return;
    }

    const cleanSteps = parseStepLines(testForm.stepsText);

    const result =
      isTestEditing && testForm.id
        ? await window.qaApi.testUpdate({
            id: testForm.id,
            projectId: selectedProjectId,
            title: testForm.title.trim(),
            steps: cleanSteps,
          })
        : await window.qaApi.testCreate({
            projectId: selectedProjectId,
            title: testForm.title.trim(),
            steps: cleanSteps,
          });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setIsTestEditing(true);
    setTestForm({
      id: result.data.id,
      title: result.data.title,
      stepsText: cleanSteps.join('\n'),
    });

    await refreshSidebar(selectedProjectId, result.data.id);
    setMessage(isTestEditing ? 'Test case updated.' : 'Test case created.');
  }

  async function deleteSelectedTest(): Promise<void> {
    if (!selectedTestId) {
      setMessage('Select a test case first.');
      return;
    }

    if (!window.confirm('Delete this test case?')) {
      return;
    }

    const result = await window.qaApi.testDelete(selectedTestId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setSelectedRunId('');
    setBugReport(null);
    setBugReportDraft('');
    await refreshSidebar(selectedProjectId);
    setMessage(result.data ? 'Test case deleted.' : 'Test case was already deleted.');
  }

  async function generateSteps(): Promise<void> {
    if (!selectedProject) {
      setMessage('Create or select a project first.');
      return;
    }

    const testTitle = testForm.title.trim();
    if (!testTitle) {
      setMessage('Enter a test title before generating steps.');
      return;
    }

    const result = await window.qaApi.aiGenerateSteps({
      title: testTitle,
      baseUrl: selectedProject.baseUrl,
      metadataJson: selectedProject.metadataJson,
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    const generatedSteps = result.data
      .map((step) => step.rawText.trim())
      .filter((stepText) => Boolean(stepText));

    if (generatedSteps.length === 0) {
      setMessage('AI returned no steps. Try a more specific test title.');
      return;
    }

    setTestForm((previous) => ({
      ...previous,
      stepsText: generatedSteps.join('\n'),
    }));
    setMessage('Generated steps ready for review.');
  }

  async function startRun(): Promise<void> {
    if (!selectedTestId) {
      setMessage('Select a test first.');
      return;
    }

    if (selectedBrowserState && !selectedBrowserState.installed) {
      await installBrowser(browser);
      const statusResult = await window.qaApi.runBrowserStatus();
      if (!statusResult.ok) {
        setMessage(statusResult.error.message);
        return;
      }

      setBrowserStates(statusResult.data);
      const current = statusResult.data.find((state) => state.browser === browser);
      if (!current?.installed) {
        setMessage(`Unable to install ${browser}. Check errors and retry.`);
        return;
      }
    }

    const result = await window.qaApi.runStart({ testCaseId: selectedTestId, browser });
    if (!result.ok) {
      setMessage(result.error.message);
      void refreshBrowserStates();
      return;
    }

    setMessage('Run started.');
    setActiveRunId(result.data.id);
    setSelectedRunId(result.data.id);
    await refreshRuns();
    await refreshStepResults();
  }

  async function cancelRun(): Promise<void> {
    if (!activeRunId) {
      return;
    }

    const result = await window.qaApi.runCancel(activeRunId);
    if (!result.ok || !result.data) {
      setMessage(result.ok ? 'No active run to cancel.' : result.error.message);
      return;
    }

    setMessage('Run cancelled immediately.');
    setActiveRunId('');
    await refreshRuns();
    await refreshStepResults();
  }

  async function installBrowser(browserName: BrowserName): Promise<void> {
    setBrowserInstallProgress((previous) => ({
      ...previous,
      [browserName]: {
        phase: 'starting',
        progress: 0,
        message: `Preparing ${browserName} installation...`,
        timestamp: new Date().toISOString(),
      },
    }));
    const result = await window.qaApi.runInstallBrowser(browserName);
    if (!result.ok) {
      setMessage(result.error.message);
      await refreshBrowserStates();
      return;
    }

    setBrowserInstallProgress((previous) => ({
      ...previous,
      [browserName]: {
        phase: 'completed',
        progress: 100,
        message: `${browserName} installed.`,
        timestamp: new Date().toISOString(),
      },
    }));
    await refreshBrowserStates();
  }

  async function generateBugReport(): Promise<void> {
    if (!selectedRunId) {
      setMessage('Select a failed run first.');
      return;
    }

    const result = await window.qaApi.aiGenerateBugReport({ runId: selectedRunId });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setBugReport(result.data);
    setBugReportDraft(formatBugReport(result.data));
    setMessage('Bug report generated.');
  }

  async function copyBugReport(): Promise<void> {
    await navigator.clipboard.writeText(bugReportDraft);
    setMessage('Bug report copied to clipboard.');
  }

  function closeBugReportDraft(): void {
    setBugReport(null);
    setBugReportDraft('');
  }

  const hasInstalledBrowser = browserStates.some((state) => state.installed);
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
  const panelClass =
    'relative overflow-hidden rounded-3xl border border-border/75 bg-card/82 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl md:p-6';
  const fieldClass =
    'w-full rounded-2xl border border-input/90 bg-background/56 px-4 py-2.5 text-sm text-foreground outline-none transition duration-200 placeholder:text-muted-foreground/65 focus:border-primary/70 focus:ring-4 focus:ring-ring/20';
  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-2xl border border-primary/70 bg-gradient-to-b from-primary to-primary/85 px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_16px_36px_-24px_hsl(198_93%_42%/0.85)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50';
  const mutedButtonClass =
    'inline-flex items-center justify-center rounded-2xl border border-border/85 bg-secondary/52 px-3.5 py-2 text-sm font-semibold text-secondary-foreground transition duration-200 hover:bg-secondary/84 disabled:cursor-not-allowed disabled:opacity-50';
  const dangerButtonClass =
    'inline-flex items-center justify-center rounded-2xl border border-danger/70 bg-danger/12 px-3.5 py-2 text-sm font-semibold text-danger transition duration-200 hover:bg-danger/18 disabled:cursor-not-allowed disabled:opacity-50';
  const onboardingShellClass =
    'mx-auto flex w-full max-w-[1540px] flex-col gap-5 min-h-[calc(100vh-2rem)] justify-center';
  const appShellClass = 'mx-auto flex w-full max-w-[1540px] flex-col gap-5';

  useEffect(() => {
    if (activeScreen !== 'project') {
      return;
    }

    setProjectFormMode('create');
    setProjectForm(DEFAULT_PROJECT_FORM);
    setIsProjectFormOpen(true);
  }, [activeScreen]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-primary/22 blur-3xl" />
        <div className="absolute right-[-8rem] top-[-4rem] h-[20rem] w-[20rem] rounded-full bg-accent/16 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[22rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <button
        type="button"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/88 text-foreground shadow-[0_14px_40px_-24px_hsl(from_var(--primary)_h_s_l/0.9)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-secondary/75 md:right-6 md:top-5"
        onClick={() => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 4.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5.25A.75.75 0 0 1 12 4.5Zm0 12.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V18a.75.75 0 0 1 .75-.75Zm7.5-5.25a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Zm-12.75 0a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1 0-1.5H6a.75.75 0 0 1 .75.75Zm9.028-4.778a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm-9.616 9.616a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm11.736 1.06a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.616-9.616a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM12 8.25a3.75 3.75 0 1 1 0 7.5a3.75 3.75 0 0 1 0-7.5Z"
              fill="currentColor"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M14.5 3.2a.75.75 0 0 1 .76.96a7.25 7.25 0 1 0 8.58 8.58a.75.75 0 0 1 .96.76A9.25 9.25 0 1 1 14.5 3.2Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
      <div className={activeScreen === 'main' ? appShellClass : onboardingShellClass}>
        {activeScreen === 'loading' ? (
          <section className="mx-auto w-full max-w-2xl">
            <div className={panelClass}>
              <h2 className="text-lg font-bold text-foreground">Loading workspace</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Checking local browser runtime status...
              </p>
            </div>
          </section>
        ) : null}

        {activeScreen === 'install' ? (
          <section className="mx-auto w-full max-w-4xl">
            <div className={panelClass}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/75">Step 1</p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">Install browsers</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    You can continue after installing at least one browser runtime.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold tracking-wide ${
                      hasInstalledBrowser
                        ? 'border-success/60 bg-success/12 text-success'
                        : 'border-warning/60 bg-warning/15 text-warning-foreground'
                    }`}
                  >
                    {hasInstalledBrowser ? 'Ready to continue' : 'Required'}
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                {browserStates.length > 0 ? (
                  browserStates.map((state) => {
                    const progressState = browserInstallProgress[state.browser];
                    const isInstalled = state.installed || progressState?.phase === 'completed';
                    const hasActiveProgressPhase =
                      progressState !== undefined &&
                      progressState.phase !== 'idle' &&
                      progressState.phase !== 'completed' &&
                      progressState.phase !== 'failed';
                    const isInstalling = !isInstalled && (state.installInProgress || hasActiveProgressPhase);
                    const installPhase: BrowserInstallPhase = isInstalled
                      ? 'completed'
                      : progressState?.phase ?? (state.lastError
                        ? 'failed'
                        : isInstalling
                          ? 'installing'
                          : 'idle');
                    const progressSuffix =
                      isInstalled
                        ? ' (100%)'
                        : typeof progressState?.progress === 'number'
                        ? ` (${Math.round(progressState.progress)}%)`
                        : '';
                    const runtimeMessage = state.lastError
                      ? state.lastError
                      : `Status: ${installPhase}${progressSuffix}`;

                    return (
                      <div
                        key={state.browser}
                        className="grid gap-2 rounded-2xl border border-border/85 bg-background/48 px-3.5 py-2.5 transition duration-200 hover:border-primary/30 hover:bg-background/66 sm:grid-cols-[110px_110px_minmax(0,1fr)_auto] sm:items-center"
                      >
                        <span className="text-sm font-semibold capitalize text-foreground">{state.browser}</span>
                        <span
                          className={`inline-flex h-6 min-w-[6rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none ${statusClassName(isInstalling ? 'installing' : isInstalled ? 'installed' : 'missing')}`}
                        >
                          {isInstalling ? 'installing' : isInstalled ? 'installed' : 'missing'}
                        </span>
                        <span className="truncate text-xs font-medium text-muted-foreground">{runtimeMessage}</span>
                        {isInstalling ? (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-primary">
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="h-4 w-4 animate-spin"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="9"
                                fill="none"
                                stroke="currentColor"
                                strokeOpacity="0.25"
                                strokeWidth="3"
                              />
                              <path
                                d="M12 3a9 9 0 0 1 9 9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                        ) : isInstalled ? null : (
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => void installBrowser(state.browser)}
                          >
                            Install
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-border bg-background/55 px-3 py-2 text-sm text-muted-foreground">
                    Loading browser runtime status...
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeScreen === 'project' ? (
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
                    onClick={() => void createProject()}
                    disabled={!canSaveProject}
                  >
                    Create project
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeScreen === 'main' ? (
          <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="xl:sticky xl:top-4">
              <div className="flex flex-col gap-4">
                <section className={panelClass}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold tracking-wide text-foreground">Projects & tests</h2>
                    <button type="button" className={primaryButtonClass} onClick={() => beginCreateProject()}>
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
                            onClick={() => selectProject(project.id)}
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
                                    onClick={() => selectTest(project.id, testCase.id)}
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
                          onChange={(event) =>
                            setProjectForm((previous) => ({ ...previous, name: event.target.value }))
                          }
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
                          onChange={(event) =>
                            setProjectForm((previous) => ({ ...previous, envLabel: event.target.value }))
                          }
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {projectFormMode === 'create' ? (
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => void createProject()}
                            disabled={!canSaveProject}
                          >
                            Create project
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => void updateSelectedProject()}
                            disabled={!selectedProject || !canSaveProject}
                          >
                            Save changes
                          </button>
                        )}
                        <button type="button" className={mutedButtonClass} onClick={() => closeProjectForm()}>
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
                          onClick={() => beginEditSelectedProject()}
                          disabled={!selectedProject}
                        >
                          Edit selected
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClass}
                          onClick={() => void deleteSelectedProject()}
                          disabled={!selectedProject}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className={panelClass}>
                  <h3 className="text-sm font-bold tracking-wide text-foreground">Workspace defaults</h3>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>Default browser: {appConfig?.defaultBrowser ?? 'chromium'}</p>
                    <p>Model target: gemini-2.5-flash</p>
                    <p>Local DB only: enabled</p>
                  </div>
                </section>
              </div>
            </aside>

            <section className="flex min-w-0 flex-col gap-4">
                <section className={panelClass}>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{testCasePanelTitle}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {testCasePanelDescription}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      hasAtLeastOneTestCase
                        ? 'border-success/60 bg-success/12 text-success'
                        : 'border-primary/60 bg-primary/12 text-primary'
                    }`}
                  >
                    {hasAtLeastOneTestCase ? 'Ready' : 'Pending'}
                  </span>
                </div>

                <div className="grid gap-3">
                  <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Test title
                    <input
                      className={fieldClass}
                      value={testForm.title}
                      onChange={(event) =>
                        setTestForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Checkout succeeds with valid card"
                    />
                    {testTitleError ? <span className="text-xs text-danger">{testTitleError}</span> : null}
                  </label>

                  <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Step script
                    <textarea
                      className={`${fieldClass} min-h-[220px] resize-y font-mono text-xs`}
                      rows={10}
                      value={testForm.stepsText}
                      onChange={(event) =>
                        setTestForm((previous) => ({ ...previous, stepsText: event.target.value }))
                      }
                      placeholder={'Click "Login"\nEnter "qa.user@example.com" in "Email" field'}
                    />
                  </label>

                  <div className="space-y-1">
                    {parsedSteps.length === 0 ? <p className="text-xs text-danger">At least one step is required.</p> : null}
                    {parsedSteps.map((_, index) => {
                      const parsed = stepParsePreview[index];
                      const parseHint =
                        parsed && parsed.ok
                          ? `Step ${index + 1}: Parsed as ${parsed.action.type} (${parsed.source})`
                          : `Step ${index + 1}: ${testStepsErrors[index] ?? 'Validation unavailable.'}`;

                      return (
                        <p
                          key={`step-parse-${index}`}
                          className={`text-xs ${parsed && parsed.ok ? 'text-muted-foreground' : 'text-danger'}`}
                        >
                          {parseHint}
                        </p>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      Supported patterns: Enter "value" in "field" field, Click "text" (or Click "text" after 1s),
                      Go to "/path", Expect assertion, or Expect assertion within 30s.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={mutedButtonClass} onClick={() => beginCreateTest()}>
                      New test case
                    </button>
                    <button type="button" className={mutedButtonClass} onClick={() => void generateSteps()}>
                      Generate steps (AI)
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void saveTestCase()}
                      disabled={!canSaveTestCase}
                    >
                      {isTestEditing ? 'Save test case' : 'Create test case'}
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClass}
                      onClick={() => void deleteSelectedTest()}
                      disabled={!selectedTest}
                    >
                      Delete test case
                    </button>
                  </div>

                  {isValidatingSteps ? <p className="text-xs text-muted-foreground">Validating steps...</p> : null}
                </div>
              </section>

                <section className={panelClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/75">Run center</p>
                      <h2 className="mt-1 text-xl font-bold text-foreground">Execute test and inspect timeline</h2>
                      <p className="text-xs text-muted-foreground">
                        Selected test: {selectedTest ? selectedTest.title : 'None selected'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Browser</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={`${fieldClass} w-[150px]`}
                        value={browser}
                        onChange={(event) => setBrowser(event.target.value as BrowserName)}
                      >
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                        <option value="webkit">WebKit</option>
                      </select>
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => void startRun()}
                      disabled={!canStartRun}
                    >
                      Start run
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClass}
                      onClick={() => void cancelRun()}
                      disabled={!activeRunId}
                    >
                      Cancel immediately
                    </button>
                    <button
                      type="button"
                      className={mutedButtonClass}
                      onClick={() => void generateBugReport()}
                      disabled={!selectedRun || selectedRun.status !== 'failed'}
                    >
                      Generate bug report
                    </button>
                    </div>
                  </div>
                </div>

                <ul className="grid gap-2">
                  {runs.map((run) => (
                    <li key={run.id}>
                      <button
                        type="button"
                        className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                          run.id === selectedRunId
                            ? 'border-primary/55 bg-primary/12'
                            : 'border-border/80 bg-background/50 hover:bg-secondary/70'
                        }`}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${runStatusClassName(run.status)}`}
                        >
                          {run.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {run.browser} | {new Date(run.startedAt).toLocaleString()} | {formatRunDuration(run)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {stepResults.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Step timeline</h3>
                      {selectedRun ? (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${runStatusClassName(selectedRun.status)}`}
                        >
                          Run {selectedRun.status.toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-2">
                      {stepResults.map((result) => (
                        <li key={result.id}>
                          <StepResultCard result={result} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {bugReport ? (
                  <div className="mt-4 space-y-2 rounded-2xl border border-border/80 bg-background/55 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold tracking-wide text-foreground">Bug report draft</h3>
                      <button type="button" className={mutedButtonClass} onClick={() => closeBugReportDraft()}>
                        Close
                      </button>
                    </div>
                    <textarea
                      className={`${fieldClass} min-h-[240px] resize-y font-mono text-xs`}
                      rows={14}
                      value={bugReportDraft}
                      onChange={(event) => setBugReportDraft(event.target.value)}
                    />
                    <button type="button" className={mutedButtonClass} onClick={() => void copyBugReport()}>
                      Copy to clipboard
                    </button>
                  </div>
                ) : null}
              </section>
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
function StepResultCard({
  result,
}: {
  result: StepResult;
}): JSX.Element {
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [isLoadingScreenshot, setIsLoadingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState('');
  const [isScreenshotViewerOpen, setIsScreenshotViewerOpen] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [copyImageStatus, setCopyImageStatus] = useState('');

  useEffect(() => {
    if (!result.screenshotPath) {
      setScreenshotDataUrl('');
      setIsLoadingScreenshot(false);
      setScreenshotError('');
      setIsScreenshotViewerOpen(false);
      return;
    }

    let cancelled = false;
    setIsLoadingScreenshot(true);
    setScreenshotError('');

    void (async () => {
      const response = await window.qaApi.runGetScreenshotDataUrl(result.screenshotPath!);
      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setScreenshotDataUrl('');
        setScreenshotError(response.error.message);
        setIsLoadingScreenshot(false);
        return;
      }

      setScreenshotDataUrl(response.data);
      setScreenshotError('');
      setIsLoadingScreenshot(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [result.screenshotPath]);

  useEffect(() => {
    if (!isScreenshotViewerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsScreenshotViewerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isScreenshotViewerOpen]);

  async function copyScreenshotImage(): Promise<void> {
    if (!screenshotDataUrl || isCopyingImage) {
      return;
    }

    setIsCopyingImage(true);
    setCopyImageStatus('');

    try {
      const clipboard = navigator.clipboard;
      const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;

      if (!clipboard?.write || !ClipboardItemCtor) {
        throw new Error('Image copy is not supported in this environment.');
      }

      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';
      const clipboardItem = new ClipboardItemCtor({ [mimeType]: blob });
      await clipboard.write([clipboardItem]);
      setCopyImageStatus('Image copied.');
    } catch (error) {
      setCopyImageStatus(toErrorMessage(error));
    } finally {
      setIsCopyingImage(false);
    }
  }

  return (
    <>
    <article className="rounded-2xl border border-border/80 bg-background/52 p-3.5 shadow-[0_20px_50px_-36px_hsl(198_93%_42%/0.75)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-foreground">
          Step {result.stepOrder}: {result.stepRawText}
        </h4>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(result.status)}`}>
          {result.status.toUpperCase()}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Screenshot preview
          </h5>
          {isLoadingScreenshot ? <p className="text-xs text-muted-foreground">Loading screenshot...</p> : null}
          {!isLoadingScreenshot && screenshotError ? <p className="text-xs text-danger">{screenshotError}</p> : null}
          {!isLoadingScreenshot && !screenshotError && screenshotDataUrl ? (
            <button
              type="button"
              className="group relative block w-full overflow-hidden rounded-lg border border-border bg-background"
              onClick={() => setIsScreenshotViewerOpen(true)}
            >
              <img
                className="max-h-[320px] w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                src={screenshotDataUrl}
                alt={`Step ${result.stepOrder} screenshot`}
              />
              <span className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-border/90 bg-card/90 px-2 py-1 text-[11px] font-semibold text-foreground">
                Click to expand
              </span>
            </button>
          ) : null}
          {!isLoadingScreenshot && !screenshotError && !screenshotDataUrl ? (
            <p className="text-xs text-muted-foreground">No screenshot captured for this step.</p>
          ) : null}
        </section>

        <section className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Error details
          </h5>
          {result.errorText ? (
            <pre className="max-h-[320px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg border border-danger/45 bg-danger/8 p-2.5 font-mono text-xs text-danger">
              {result.errorText}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">No error recorded.</p>
          )}
        </section>
      </div>
    </article>
    {isScreenshotViewerOpen && screenshotDataUrl && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Step ${result.stepOrder} screenshot viewer`}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setIsScreenshotViewerOpen(false)}
          >
            <div className="relative max-h-[95vh] max-w-[95vw]" onClick={(event) => event.stopPropagation()}>
              <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                {copyImageStatus ? (
                  <span className="rounded-md border border-border/80 bg-card/92 px-2 py-1 text-[11px] font-medium text-foreground">
                    {copyImageStatus}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-border/80 bg-card/92 px-3 text-xs font-semibold text-foreground transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void copyScreenshotImage()}
                  disabled={isCopyingImage}
                >
                  {isCopyingImage ? 'Copying...' : 'Copy image'}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-card/92 text-foreground transition hover:bg-secondary/85"
                  onClick={() => setIsScreenshotViewerOpen(false)}
                  aria-label="Close screenshot viewer"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <img
                src={screenshotDataUrl}
                alt={`Step ${result.stepOrder} screenshot full size`}
                className="max-h-[95vh] max-w-[95vw] rounded-xl border border-border/80 bg-background object-contain shadow-2xl"
              />
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}

function validateBaseUrl(baseUrl: string): string | null {
  const value = baseUrl.trim();
  if (!value) {
    return 'Base URL is required.';
  }

  try {
    void new URL(value);
    return null;
  } catch {
    return 'Base URL must be a valid URL including protocol (https://...).';
  }
}

function parseStepLines(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => Boolean(line));
}

function formatBugReport(report: GeneratedBugReport): string {
  return [
    `Title: ${report.title}`,
    `Environment: ${report.environment}`,
    '',
    'Steps to Reproduce:',
    ...report.stepsToReproduce.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Expected Result: ${report.expectedResult}`,
    `Actual Result: ${report.actualResult}`,
    '',
    'Evidence:',
    ...report.evidence.map((item) => `- ${item}`),
  ].join('\n');
}

function formatRunDuration(run: Run): string {
  const startedAt = Date.parse(run.startedAt);
  const endedAt = Date.parse(run.endedAt ?? new Date().toISOString());
  const durationMs = Math.max(0, endedAt - startedAt);
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function statusClassName(status: StepResult['status'] | 'installed' | 'missing' | 'installing'): string {
  if (status === 'passed' || status === 'installed') {
    return 'border-success/60 bg-success/12 text-success';
  }

  if (status === 'installing') {
    return 'border-primary/60 bg-primary/10 text-primary';
  }

  if (status === 'failed' || status === 'missing') {
    return 'border-danger/60 bg-danger/12 text-danger';
  }

  if (status === 'cancelled') {
    return 'border-border bg-secondary/50 text-muted-foreground';
  }

  return 'border-primary/60 bg-primary/10 text-primary';
}

function runStatusClassName(status: Run['status']): string {
  if (status === 'passed') {
    return 'border-success/60 bg-success/12 text-success';
  }

  if (status === 'failed') {
    return 'border-danger/60 bg-danger/12 text-danger';
  }

  if (status === 'cancelled') {
    return 'border-border bg-secondary/50 text-muted-foreground';
  }

  return 'border-primary/60 bg-primary/10 text-primary';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
