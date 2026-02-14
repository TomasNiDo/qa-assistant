import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppConfig,
  BrowserName,
  GeneratedBugReport,
  Project,
  Run,
  Step,
  StepParseResult,
  StepResult,
  TestCase,
} from '@shared/types';
import { HelloPage } from './pages/HelloPage';

const TABS = ['hello', 'projects', 'tests', 'runs'] as const;
type TabKey = (typeof TABS)[number];

interface ProjectFormState {
  id: string;
  name: string;
  baseUrl: string;
  envLabel: string;
}

interface TestFormState {
  id: string;
  title: string;
  steps: string[];
}

const DEFAULT_PROJECT_FORM: ProjectFormState = {
  id: '',
  name: '',
  baseUrl: 'https://example.com',
  envLabel: 'local',
};

const DEFAULT_TEST_FORM: TestFormState = {
  id: '',
  title: '',
  steps: ['Click "Login"'],
};

export function App(): JSX.Element {
  const [tab, setTab] = useState<TabKey>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const [isProjectEditing, setIsProjectEditing] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(DEFAULT_PROJECT_FORM);

  const [isTestEditing, setIsTestEditing] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>(DEFAULT_TEST_FORM);
  const [stepParsePreview, setStepParsePreview] = useState<StepParseResult[]>([]);
  const [isValidatingSteps, setIsValidatingSteps] = useState(false);

  const [browser, setBrowser] = useState<BrowserName>('chromium');
  const [activeRunId, setActiveRunId] = useState('');
  const [bugReport, setBugReport] = useState<GeneratedBugReport | null>(null);
  const [bugReportDraft, setBugReportDraft] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [healthStatus, setHealthStatus] = useState('');
  const [seedInProgress, setSeedInProgress] = useState(false);

  const [message, setMessage] = useState('');
  const stepValidationVersion = useRef(0);
  const autoSeedAttempted = useRef(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedTest = useMemo(
    () => tests.find((testCase) => testCase.id === selectedTestId) ?? null,
    [tests, selectedTestId],
  );

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const refreshProjects = useCallback(async () => {
    const result = await window.qaApi.projectList();
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setProjects(result.data);
    setProjectsLoaded(true);
    if (result.data.length === 0) {
      setSelectedProjectId('');
      return;
    }

    if (!result.data.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(result.data[0].id);
    }
  }, [selectedProjectId]);

  const refreshTests = useCallback(async () => {
    if (!selectedProjectId) {
      setTests([]);
      setSelectedTestId('');
      return;
    }

    const result = await window.qaApi.testList(selectedProjectId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setTests(result.data);
    if (result.data.length === 0) {
      setSelectedTestId('');
      return;
    }

    if (!result.data.find((test) => test.id === selectedTestId)) {
      setSelectedTestId(result.data[0].id);
    }
  }, [selectedProjectId, selectedTestId]);

  const refreshSteps = useCallback(async () => {
    if (!selectedTestId) {
      setSteps([]);
      return;
    }

    const result = await window.qaApi.stepList(selectedTestId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setSteps(result.data);
  }, [selectedTestId]);

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

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    void refreshTests();
  }, [refreshTests]);

  useEffect(() => {
    void refreshSteps();
    void refreshRuns();
  }, [refreshRuns, refreshSteps]);

  useEffect(() => {
    void refreshStepResults();
  }, [refreshStepResults]);

  useEffect(() => {
    const version = stepValidationVersion.current + 1;
    stepValidationVersion.current = version;
    setIsValidatingSteps(true);

    if (testForm.steps.length === 0) {
      setStepParsePreview([]);
      setIsValidatingSteps(false);
      return;
    }

    void (async () => {
      const results: StepParseResult[] = [];

      for (const stepText of testForm.steps) {
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
  }, [testForm.steps]);

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
      steps: generatedSteps,
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

      setSelectedProjectId(result.data.project.id);
      setSelectedTestId(result.data.testCase.id);
      await refreshProjects();
      await refreshTests();

      const latestSteps = await window.qaApi.stepList(result.data.testCase.id);
      if (latestSteps.ok) {
        setSteps(latestSteps.data);
      }

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
    [refreshProjects, refreshTests, seedInProgress],
  );

  const runHealthPing = useCallback(async (): Promise<void> => {
    const result = await window.qaApi.healthPing();
    if (!result.ok) {
      setHealthStatus(`error: ${result.error.message}`);
      setMessage(result.error.message);
      return;
    }

    setHealthStatus(result.data);
    setMessage(`IPC health ping successful: ${result.data}`);
  }, []);

  const loadConfig = useCallback(async (): Promise<void> => {
    const result = await window.qaApi.configGet();
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setAppConfig(result.data);
    setBrowser(result.data.defaultBrowser);
    setMessage('Config loaded from local appData.');
  }, []);

  const saveConfig = useCallback(async (): Promise<void> => {
    if (!appConfig) {
      setMessage('Load config before saving.');
      return;
    }

    const result = await window.qaApi.configSet(appConfig);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setAppConfig(result.data);
    setBrowser(result.data.defaultBrowser);
    setMessage('Config saved to local appData.');
  }, [appConfig]);

  useEffect(() => {
    void runHealthPing();
    void loadConfig();
  }, [loadConfig, runHealthPing]);

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
  const testStepsErrors = testForm.steps.map((stepText, index) => {
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
  const hasStepErrors = testStepsErrors.some(Boolean) || testForm.steps.length === 0;
  const canSaveTestCase =
    Boolean(selectedProjectId) &&
    !testTitleError &&
    !hasStepErrors &&
    !isValidatingSteps;

  function beginCreateProject(): void {
    setIsProjectEditing(false);
    setProjectForm(DEFAULT_PROJECT_FORM);
  }

  function beginEditSelectedProject(): void {
    if (!selectedProject) {
      setMessage('Select a project first.');
      return;
    }

    setIsProjectEditing(true);
    setProjectForm({
      id: selectedProject.id,
      name: selectedProject.name,
      baseUrl: selectedProject.baseUrl,
      envLabel: selectedProject.envLabel,
    });
  }

  async function saveProject(): Promise<void> {
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

    const result =
      isProjectEditing && projectForm.id
        ? await window.qaApi.projectUpdate({ id: projectForm.id, ...payload })
        : await window.qaApi.projectCreate(payload);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setSelectedProjectId(result.data.id);
    setIsProjectEditing(true);
    setProjectForm({
      id: result.data.id,
      name: result.data.name,
      baseUrl: result.data.baseUrl,
      envLabel: result.data.envLabel,
    });
    setMessage(isProjectEditing ? 'Project updated.' : 'Project created.');
    await refreshProjects();
  }

  async function deleteSelectedProject(): Promise<void> {
    if (!selectedProjectId) {
      setMessage('Select a project first.');
      return;
    }

    if (!window.confirm('Delete this project and all related tests/runs?')) {
      return;
    }

    const result = await window.qaApi.projectDelete(selectedProjectId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    beginCreateProject();
    setSelectedProjectId('');
    setSelectedTestId('');
    setSelectedRunId('');
    setMessage(result.data ? 'Project deleted.' : 'Project was already deleted.');
    await refreshProjects();
  }

  function beginCreateTest(): void {
    setIsTestEditing(false);
    setTestForm(DEFAULT_TEST_FORM);
  }

  async function beginEditSelectedTest(): Promise<void> {
    if (!selectedTest) {
      setMessage('Select a test case first.');
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
      steps: stepRowsResult.data.map((step) => step.rawText),
    });
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

    const cleanSteps = testForm.steps.map((stepText) => stepText.trim());

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

    setSelectedTestId(result.data.id);
    setIsTestEditing(true);
    setTestForm({
      id: result.data.id,
      title: result.data.title,
      steps: cleanSteps,
    });
    setMessage(isTestEditing ? 'Test case updated.' : 'Test case created.');
    await refreshTests();

    const latestSteps = await window.qaApi.stepList(result.data.id);
    if (latestSteps.ok) {
      setSteps(latestSteps.data);
    }
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

    beginCreateTest();
    setSelectedTestId('');
    setSteps([]);
    setMessage(result.data ? 'Test case deleted.' : 'Test case was already deleted.');
    await refreshTests();
  }

  function addStepRow(): void {
    setTestForm((previous) => ({
      ...previous,
      steps: [...previous.steps, ''],
    }));
  }

  function updateStepRow(index: number, value: string): void {
    setTestForm((previous) => ({
      ...previous,
      steps: previous.steps.map((step, stepIndex) => (stepIndex === index ? value : step)),
    }));
  }

  function removeStepRow(index: number): void {
    setTestForm((previous) => ({
      ...previous,
      steps: previous.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  }

  function moveStepRow(index: number, direction: -1 | 1): void {
    setTestForm((previous) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= previous.steps.length) {
        return previous;
      }

      const nextSteps = [...previous.steps];
      const currentStep = nextSteps[index];
      nextSteps[index] = nextSteps[nextIndex];
      nextSteps[nextIndex] = currentStep;

      return {
        ...previous,
        steps: nextSteps,
      };
    });
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>QA Assistant</h1>
        <p>Local-first QA test builder with AI-assisted authoring.</p>
      </header>

      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item}
            className={tab === item ? 'tab tab-active' : 'tab'}
            type="button"
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {message ? <p className="message">{message}</p> : null}

      {tab === 'hello' ? (
        <HelloPage
          healthStatus={healthStatus}
          config={appConfig}
          seedInProgress={seedInProgress}
          onPing={runHealthPing}
          onLoadConfig={loadConfig}
          onSaveConfig={saveConfig}
          onSeedSampleProject={seedSampleProject}
          onUpdateConfig={setAppConfig}
        />
      ) : null}

      {tab === 'projects' ? (
        <section className="panel">
          <h2>Projects</h2>
          <p>Create or edit local environments used for test authoring and execution.</p>
          <div className="grid two">
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
          </div>

          <div className="row">
            <button type="button" onClick={() => void saveProject()} disabled={!canSaveProject}>
              {isProjectEditing ? 'Save Project' : 'Create Project'}
            </button>
            <button type="button" onClick={() => beginEditSelectedProject()} disabled={!selectedProject}>
              Edit Selected
            </button>
            <button type="button" onClick={() => beginCreateProject()}>
              {isProjectEditing ? 'Cancel Edit' : 'Clear Form'}
            </button>
            <button type="button" onClick={() => void deleteSelectedProject()} disabled={!selectedProject}>
              Delete Selected
            </button>
          </div>

          <ul className="list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className={project.id === selectedProjectId ? 'select active' : 'select'}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <strong>{project.name}</strong>
                  <span>
                    {project.baseUrl} ({project.envLabel})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'tests' ? (
        <section className="panel">
          <h2>Tests</h2>
          <p>Selected project: {selectedProject?.name ?? 'none'}</p>
          <p>Saved steps for selected test: {steps.length}</p>

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
              <div className="row">
                <strong>Steps</strong>
                <button type="button" onClick={() => addStepRow()}>
                  Add Step
                </button>
              </div>

              <ol className="step-list">
                {testForm.steps.map((rawStep, index) => {
                  const parsed = stepParsePreview[index];
                  const parseHint =
                    parsed && parsed.ok
                      ? `Parsed as ${parsed.action.type} (${parsed.source})`
                      : testStepsErrors[index];

                  return (
                    <li key={`${index}-${rawStep}`} className="step-item">
                      <textarea
                        rows={2}
                        value={rawStep}
                        onChange={(event) => updateStepRow(index, event.target.value)}
                      />
                      <div className="row">
                        <button
                          type="button"
                          onClick={() => moveStepRow(index, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStepRow(index, 1)}
                          disabled={index === testForm.steps.length - 1}
                        >
                          Down
                        </button>
                        <button type="button" onClick={() => removeStepRow(index)}>
                          Delete
                        </button>
                      </div>
                      {parseHint ? (
                        <span className={parsed && parsed.ok ? 'field-hint' : 'field-error'}>
                          {parseHint}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              <p className="field-hint">
                Supported patterns: Enter "value" in "field" field, Click "text", Expect assertion.
              </p>
            </div>
          </div>

          <div className="row">
            <button type="button" onClick={() => void generateSteps()} disabled={!selectedProject}>
              Generate Steps (AI)
            </button>
            <button type="button" onClick={() => beginCreateTest()}>
              {isTestEditing ? 'Cancel Edit' : 'New Draft'}
            </button>
            <button type="button" onClick={() => void beginEditSelectedTest()} disabled={!selectedTest}>
              Edit Selected
            </button>
            <button type="button" onClick={() => void saveTestCase()} disabled={!canSaveTestCase}>
              {isTestEditing ? 'Save Test Case' : 'Create Test Case'}
            </button>
            <button type="button" onClick={() => void deleteSelectedTest()} disabled={!selectedTest}>
              Delete Selected
            </button>
          </div>

          {isValidatingSteps ? <p className="field-hint">Validating steps...</p> : null}

          <ul className="list">
            {tests.map((testCase) => (
              <li key={testCase.id}>
                <button
                  type="button"
                  className={testCase.id === selectedTestId ? 'select active' : 'select'}
                  onClick={() => setSelectedTestId(testCase.id)}
                >
                  <strong>{testCase.title}</strong>
                  <span>updated {new Date(testCase.updatedAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'runs' ? (
        <section className="panel">
          <h2>Runs</h2>
          <p>Selected test ID: {selectedTestId || 'none'}</p>

          <div className="row">
            <label>
              Browser
              <select value={browser} onChange={(event) => setBrowser(event.target.value as BrowserName)}>
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </label>
            <button type="button" onClick={() => void startRun()}>
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
      ) : null}
    </main>
  );
}

function validateBaseUrl(baseUrl: string): string | null {
  const value = baseUrl.trim();
  if (!value) {
    return 'Base URL is required.';
  }

  try {
    // URL constructor enforces explicit protocol and host structure.
    void new URL(value);
    return null;
  } catch {
    return 'Base URL must be a valid URL including protocol (https://...).';
  }
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
