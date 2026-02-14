import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function App(): JSX.Element {
  const [tab, setTab] = useState<TabKey>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const [projectName, setProjectName] = useState('');
  const [projectBaseUrl, setProjectBaseUrl] = useState('https://example.com');
  const [projectEnv, setProjectEnv] = useState('local');

  const [testTitle, setTestTitle] = useState('');
  const [stepText, setStepText] = useState('Click "Login"\nExpect user dashboard');
  const [stepParsePreview, setStepParsePreview] = useState<Array<{ rawText: string; result: StepParseResult }>>([]);

  const [browser, setBrowser] = useState<BrowserName>('chromium');
  const [activeRunId, setActiveRunId] = useState('');
  const [bugReport, setBugReport] = useState<GeneratedBugReport | null>(null);
  const [bugReportDraft, setBugReportDraft] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [healthStatus, setHealthStatus] = useState('');

  const [message, setMessage] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
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
    if (!selectedProjectId && result.data.length > 0) {
      setSelectedProjectId(result.data[0].id);
    }
  }, [selectedProjectId]);

  const refreshTests = useCallback(async () => {
    if (!selectedProjectId) {
      setTests([]);
      return;
    }

    const result = await window.qaApi.testList(selectedProjectId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setTests(result.data);
    if (result.data.length > 0 && !result.data.find((test) => test.id === selectedTestId)) {
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
      return;
    }

    const result = await window.qaApi.runHistory(selectedTestId);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setRuns(result.data);
    if (result.data.length > 0 && !result.data.find((run) => run.id === selectedRunId)) {
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

  async function createProject(): Promise<void> {
    const result = await window.qaApi.projectCreate({
      name: projectName,
      baseUrl: projectBaseUrl,
      envLabel: projectEnv,
      metadata: {},
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Project created.');
    setProjectName('');
    await refreshProjects();
    setSelectedProjectId(result.data.id);
  }

  async function createTestCase(): Promise<void> {
    if (!selectedProjectId) {
      setMessage('Select a project first.');
      return;
    }

    const parsedLines = parseSteps(stepText);
    const result = await window.qaApi.testCreate({
      projectId: selectedProjectId,
      title: testTitle,
      steps: parsedLines,
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Test case created.');
    setTestTitle('');
    await refreshTests();
    setSelectedTestId(result.data.id);
  }

  async function validateSteps(): Promise<void> {
    const parsedLines = parseSteps(stepText);
    const parsed: Array<{ rawText: string; result: StepParseResult }> = [];

    for (const line of parsedLines) {
      const result = await window.qaApi.stepParse(line);
      if (!result.ok) {
        parsed.push({ rawText: line, result: { ok: false, error: result.error.message } });
      } else {
        parsed.push({ rawText: line, result: result.data });
      }
    }

    setStepParsePreview(parsed);
  }

  async function generateSteps(): Promise<void> {
    if (!selectedProject) {
      setMessage('Create or select a project first.');
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

    setStepText(result.data.map((step) => step.rawText).join('\n'));
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
          onPing={runHealthPing}
          onLoadConfig={loadConfig}
          onSaveConfig={saveConfig}
          onUpdateConfig={setAppConfig}
        />
      ) : null}

      {tab === 'projects' ? (
        <section className="panel">
          <h2>Projects</h2>
          <div className="grid two">
            <label>
              Name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label>
              Base URL
              <input value={projectBaseUrl} onChange={(event) => setProjectBaseUrl(event.target.value)} />
            </label>
            <label>
              Environment
              <input value={projectEnv} onChange={(event) => setProjectEnv(event.target.value)} />
            </label>
          </div>
          <button type="button" onClick={() => void createProject()}>
            Create Project
          </button>

          <ul className="list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className={project.id === selectedProjectId ? 'select active' : 'select'}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <strong>{project.name}</strong> <span>{project.baseUrl}</span>
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
              <input value={testTitle} onChange={(event) => setTestTitle(event.target.value)} />
            </label>
            <label>
              Steps (one per line)
              <textarea
                rows={10}
                value={stepText}
                onChange={(event) => setStepText(event.target.value)}
              />
            </label>
          </div>

          <div className="row">
            <button type="button" onClick={() => void generateSteps()}>
              Generate Steps (AI)
            </button>
            <button type="button" onClick={() => void validateSteps()}>
              Validate Steps
            </button>
            <button type="button" onClick={() => void createTestCase()}>
              Save Test Case
            </button>
          </div>

          {stepParsePreview.length > 0 ? (
            <ul className="list">
              {stepParsePreview.map((item, index) => (
                <li key={`${item.rawText}-${index}`}>
                  <code>{item.rawText}</code>
                  <span>{item.result.ok ? `OK (${item.result.source})` : item.result.error}</span>
                </li>
              ))}
            </ul>
          ) : null}

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

function parseSteps(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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
