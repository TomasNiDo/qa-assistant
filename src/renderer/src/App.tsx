import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppConfig,
  BrowserName,
  GeneratedBugReport,
  Project,
  Run,
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

export function App(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
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
  const [activeRunId, setActiveRunId] = useState('');
  const [bugReport, setBugReport] = useState<GeneratedBugReport | null>(null);
  const [bugReportDraft, setBugReportDraft] = useState('');

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [seedInProgress, setSeedInProgress] = useState(false);

  const [message, setMessage] = useState('');
  const stepValidationVersion = useRef(0);
  const autoSeedAttempted = useRef(false);

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
        setProjectsLoaded(true);
        return;
      }

      if (!result.ok) {
        setMessage(result.error.message);
        setProjectsLoaded(true);
        return;
      }

      const rows = result.data;
      setProjects(rows);
      setProjectsLoaded(true);

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

    setRuns(result.data);
    if (result.data.length === 0) {
      setSelectedRunId('');
      return;
    }

    if (!result.data.find((run) => run.id === selectedRunId)) {
      setSelectedRunId(result.data[0].id);
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

  const loadSelectedTestIntoForm = useCallback(async () => {
    if (!selectedTest) {
      setIsTestEditing(false);
      setTestForm(DEFAULT_TEST_FORM);
      return;
    }

    const stepRowsResult = await window.qaApi.stepList(selectedTest.id);
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

  const seedSampleProject = useCallback(
    async (mode: 'manual' | 'auto' = 'manual'): Promise<void> => {
      if (seedInProgress) {
        return;
      }

      setSeedInProgress(true);
      const result = await window.qaApi.seedSampleProject();
      setSeedInProgress(false);

      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }

      await refreshSidebar(result.data.project.id, result.data.testCase.id);

      if (mode === 'manual') {
        if (!result.data.createdProject && !result.data.createdTestCase) {
          setMessage('Sample project already exists.');
          return;
        }

        setMessage(
          `Sample seed complete. Created project: ${result.data.createdProject ? 'yes' : 'no'}, test: ${result.data.createdTestCase ? 'yes' : 'no'}.`,
        );
        return;
      }

      if (result.data.createdProject || result.data.createdTestCase) {
        setMessage('Sample project seeded automatically.');
      }
    },
    [refreshSidebar, seedInProgress],
  );

  useEffect(() => {
    if (!appConfig?.enableSampleProjectSeed) {
      autoSeedAttempted.current = false;
      return;
    }

    if (!projectsLoaded || projects.length > 0 || seedInProgress || autoSeedAttempted.current) {
      return;
    }

    autoSeedAttempted.current = true;
    void seedSampleProject('auto');
  }, [
    appConfig?.enableSampleProjectSeed,
    projects.length,
    projectsLoaded,
    seedInProgress,
    seedSampleProject,
  ]);

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

    const result = await window.qaApi.runStart({ testCaseId: selectedTestId, browser });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Run started.');
    setActiveRunId(result.data.id);
    setSelectedRunId(result.data.id);
    await refreshRuns();
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

  return (
    <main className="shell">
      <header className="header">
        <h1>QA Assistant</h1>
        <p>Local-first QA test builder with AI-assisted authoring.</p>
      </header>

      {message ? <p className="message">{message}</p> : null}

      <div className="workspace">
        <aside className="panel sidebar">
          <div className="sidebar-heading">
            <h2>Projects</h2>
            <button type="button" onClick={() => beginCreateProject()}>
              New Project
            </button>
          </div>

          <ul className="tree-list">
            {projects.map((project) => {
              const projectTests = testCasesByProject[project.id] ?? [];

              return (
                <li key={project.id} className="tree-project-item">
                  <button
                    type="button"
                    className={project.id === selectedProjectId ? 'tree-project active' : 'tree-project'}
                    onClick={() => selectProject(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.envLabel}</span>
                  </button>

                  {projectTests.length > 0 ? (
                    <ul className="tree-tests">
                      {projectTests.map((testCase) => (
                        <li key={testCase.id}>
                          <button
                            type="button"
                            className={testCase.id === selectedTestId ? 'tree-test active' : 'tree-test'}
                            onClick={() => selectTest(project.id, testCase.id)}
                          >
                            {testCase.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="field-hint tree-empty">No test cases</p>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="sidebar-settings">
            {isProjectFormOpen ? (
              <>
                <h3>{projectFormMode === 'create' ? 'Create Project' : 'Edit Project'}</h3>
                <label>
                  Name
                  <input
                    value={projectForm.name}
                    onChange={(event) =>
                      setProjectForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                  {projectNameError ? <span className="field-error">{projectNameError}</span> : null}
                </label>

                <label>
                  Base URL
                  <input
                    value={projectForm.baseUrl}
                    onChange={(event) =>
                      setProjectForm((previous) => ({ ...previous, baseUrl: event.target.value }))
                    }
                  />
                  {projectBaseUrlError ? (
                    <span className="field-error">{projectBaseUrlError}</span>
                  ) : (
                    <span className="field-hint">Include protocol, for example https://example.com</span>
                  )}
                </label>

                <label>
                  Environment
                  <input
                    value={projectForm.envLabel}
                    onChange={(event) =>
                      setProjectForm((previous) => ({ ...previous, envLabel: event.target.value }))
                    }
                  />
                </label>

                <div className="row">
                  {projectFormMode === 'create' ? (
                    <button type="button" onClick={() => void createProject()} disabled={!canSaveProject}>
                      Create Project
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateSelectedProject()}
                      disabled={!selectedProject || !canSaveProject}
                    >
                      Update Selected
                    </button>
                  )}
                  <button type="button" onClick={() => closeProjectForm()}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Project Actions</h3>
                <p className="field-hint">Project form is hidden. Click New Project to create.</p>
                <div className="row">
                  <button type="button" onClick={() => beginEditSelectedProject()} disabled={!selectedProject}>
                    Edit Selected
                  </button>
                  <button type="button" onClick={() => void deleteSelectedProject()} disabled={!selectedProject}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </section>
        </aside>

        <section className="main-content">
          {selectedProject ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>Test Case Settings</h2>
                  <p>
                    Project: <strong>{selectedProject.name}</strong>
                  </p>
                </div>

                <div className="grid one">
                  <label>
                    Test title
                    <input
                      value={testForm.title}
                      onChange={(event) =>
                        setTestForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                    />
                    {testTitleError ? <span className="field-error">{testTitleError}</span> : null}
                  </label>

                  <div>
                    <strong>Steps</strong>
                    <textarea
                      className="steps-textarea"
                      rows={10}
                      value={testForm.stepsText}
                      onChange={(event) =>
                        setTestForm((previous) => ({ ...previous, stepsText: event.target.value }))
                      }
                      placeholder={'Click "Login"\nEnter "qa.user@example.com" in "Email" field'}
                    />
                    {parsedSteps.length === 0 ? (
                      <span className="field-error">At least one step is required.</span>
                    ) : null}
                    {parsedSteps.map((_, index) => {
                      const parsed = stepParsePreview[index];
                      const parseHint =
                        parsed && parsed.ok
                          ? `Step ${index + 1}: Parsed as ${parsed.action.type} (${parsed.source})`
                          : `Step ${index + 1}: ${testStepsErrors[index] ?? 'Validation unavailable.'}`;

                      return (
                        <span
                          key={`step-parse-${index}`}
                          className={`step-parse-hint ${parsed && parsed.ok ? 'field-hint' : 'field-error'}`}
                        >
                          {parseHint}
                        </span>
                      );
                    })}

                    <p className="field-hint">
                      Enter one step per line. Supported patterns: Enter "value" in "field" field,
                      Click "text", Expect assertion.
                    </p>
                  </div>
                </div>

                <div className="row">
                  <button type="button" onClick={() => beginCreateTest()}>
                    New Test
                  </button>
                  <button type="button" onClick={() => void generateSteps()}>
                    Generate Steps (AI)
                  </button>
                  <button type="button" onClick={() => void saveTestCase()} disabled={!canSaveTestCase}>
                    {isTestEditing ? 'Save Test Case' : 'Create Test Case'}
                  </button>
                  <button type="button" onClick={() => void deleteSelectedTest()} disabled={!selectedTest}>
                    Delete Test Case
                  </button>
                </div>

                {isValidatingSteps ? <p className="field-hint">Validating steps...</p> : null}
              </section>

              <section className="panel">
                <div className="section-heading">
                  <h2>Test Run Result</h2>
                  <p>
                    Selected test:{' '}
                    <strong>{selectedTest ? selectedTest.title : 'None selected'}</strong>
                  </p>
                </div>

                <div className="row">
                  <label>
                    Browser
                    <select
                      value={browser}
                      onChange={(event) => setBrowser(event.target.value as BrowserName)}
                    >
                      <option value="chromium">Chromium</option>
                      <option value="firefox">Firefox</option>
                      <option value="webkit">WebKit</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => void startRun()} disabled={!selectedTestId}>
                    Start Run
                  </button>
                  <button type="button" onClick={() => void cancelRun()} disabled={!activeRunId}>
                    Cancel Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateBugReport()}
                    disabled={!selectedRun || selectedRun.status !== 'failed'}
                  >
                    Generate Bug Report
                  </button>
                </div>

                <ul className="list">
                  {runs.map((run) => (
                    <li key={run.id}>
                      <button
                        type="button"
                        className={run.id === selectedRunId ? 'select active' : 'select'}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <strong>{run.status.toUpperCase()}</strong>
                        <span>
                          {run.browser} | {new Date(run.startedAt).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {stepResults.length > 0 ? (
                  <div>
                    <h3>Step Results</h3>
                    <ul className="list">
                      {stepResults.map((result) => (
                        <li key={result.id}>
                          <code>{result.stepId}</code>
                          <span>
                            {result.status}
                            {result.errorText ? ` | ${result.errorText}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {bugReport ? (
                  <div>
                    <h3>Bug Report Draft</h3>
                    <textarea
                      rows={14}
                      value={bugReportDraft}
                      onChange={(event) => setBugReportDraft(event.target.value)}
                    />
                    <button type="button" onClick={() => void copyBugReport()}>
                      Copy to Clipboard
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="section-heading">
                <h2>Get Started</h2>
                <p>Create a project in the sidebar to begin test case setup and run results.</p>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
