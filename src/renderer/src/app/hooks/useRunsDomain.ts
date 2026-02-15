import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActiveRunContext,
  AppConfig,
  BrowserInstallState,
  BrowserInstallUpdate,
  BrowserName,
  Run,
  RunUpdateEvent,
  StepResult,
} from '@shared/types';
import type { BrowserInstallProgressState } from '../types';

interface UseRunsDomainArgs {
  selectedTestId: string;
  onMessage: (message: string) => void;
}

export interface RunUpdateEffects {
  nextSelectedRunId?: string;
  clearActiveRunId: boolean;
  refreshRuns: boolean;
  refreshStepResults: boolean;
  refreshBrowserStates: boolean;
  refreshActiveRunContext: boolean;
}

export function deriveRunUpdateEffects(
  update: RunUpdateEvent,
  selectedRunId: string,
  activeRunId: string,
): RunUpdateEffects {
  if (update.type === 'run-started') {
    return {
      nextSelectedRunId: update.runId,
      clearActiveRunId: false,
      refreshRuns: true,
      refreshStepResults: true,
      refreshBrowserStates: false,
      refreshActiveRunContext: true,
    };
  }

  if (update.type === 'step-started' || update.type === 'step-finished') {
    return {
      clearActiveRunId: false,
      refreshRuns: true,
      refreshStepResults: update.runId === selectedRunId || update.runId === activeRunId,
      refreshBrowserStates: false,
      refreshActiveRunContext: false,
    };
  }

  return {
    clearActiveRunId: update.runId === activeRunId,
    refreshRuns: true,
    refreshStepResults: update.runId === selectedRunId || update.runId === activeRunId,
    refreshBrowserStates: true,
    refreshActiveRunContext: true,
  };
}

export interface UseRunsDomainResult {
  runs: Run[];
  selectedRunId: string;
  setSelectedRunId: (runId: string) => void;
  selectedRun: Run | null;
  stepResults: StepResult[];
  browser: BrowserName;
  setBrowser: (browser: BrowserName) => void;
  browserStates: BrowserInstallState[];
  browserInstallProgress: Partial<Record<BrowserName, BrowserInstallProgressState>>;
  selectedBrowserState: BrowserInstallState | null;
  isBrowserStatesLoaded: boolean;
  hasInstalledBrowser: boolean;
  activeRunId: string;
  activeRunContext: ActiveRunContext | null;
  appConfig: AppConfig | null;
  refreshActiveRunContext: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  refreshStepResults: () => Promise<void>;
  refreshBrowserStates: () => Promise<void>;
  startRun: () => Promise<void>;
  cancelRun: () => Promise<void>;
  installBrowser: (browserName: BrowserName) => Promise<void>;
  clearRunSelectionState: () => void;
}

export function useRunsDomain({ selectedTestId, onMessage }: UseRunsDomainArgs): UseRunsDomainResult {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [browser, setBrowser] = useState<BrowserName>('chromium');
  const [browserStates, setBrowserStates] = useState<BrowserInstallState[]>([]);
  const [browserInstallProgress, setBrowserInstallProgress] = useState<
    Partial<Record<BrowserName, BrowserInstallProgressState>>
  >({});
  const [isBrowserStatesLoaded, setIsBrowserStatesLoaded] = useState(false);
  const [activeRunId, setActiveRunId] = useState('');
  const [activeRunContext, setActiveRunContext] = useState<ActiveRunContext | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const selectedBrowserState = useMemo(
    () => browserStates.find((state) => state.browser === browser) ?? null,
    [browser, browserStates],
  );

  const hasInstalledBrowser = browserStates.some((state) => state.installed);

  const refreshActiveRunContext = useCallback(async () => {
    let result: Awaited<ReturnType<typeof window.qaApi.runActiveContext>>;
    try {
      result = await window.qaApi.runActiveContext();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onMessage(`Failed loading active run context: ${message}`);
      return;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return;
    }

    setActiveRunContext(result.data);
  }, [onMessage]);

  const refreshRuns = useCallback(async () => {
    if (!selectedTestId) {
      setRuns([]);
      setSelectedRunId('');
      return;
    }

    const result = await window.qaApi.runHistory(selectedTestId);
    if (!result.ok) {
      onMessage(result.error.message);
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
  }, [onMessage, selectedRunId, selectedTestId]);

  const refreshStepResults = useCallback(async () => {
    if (!selectedRunId) {
      setStepResults([]);
      return;
    }

    const result = await window.qaApi.stepResults(selectedRunId);
    if (!result.ok) {
      onMessage(result.error.message);
      return;
    }

    setStepResults(result.data);
  }, [onMessage, selectedRunId]);

  const refreshBrowserStates = useCallback(async () => {
    try {
      const result = await window.qaApi.runBrowserStatus();
      if (!result.ok) {
        onMessage(result.error.message);
        return;
      }

      setBrowserStates(result.data);
    } finally {
      setIsBrowserStatesLoaded(true);
    }
  }, [onMessage]);

  const loadConfig = useCallback(async (): Promise<void> => {
    const result = await window.qaApi.configGet();
    if (!result.ok) {
      onMessage(result.error.message);
      return;
    }

    setAppConfig(result.data);
    setBrowser(result.data.defaultBrowser);
  }, [onMessage]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

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
    void refreshActiveRunContext();
  }, [refreshActiveRunContext]);

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const status = await window.qaApi.runStatus(activeRunId);
      if (!status.ok) {
        return;
      }

      if (!status.data) {
        window.clearInterval(intervalId);
        setActiveRunId('');
        await refreshRuns();
        await refreshActiveRunContext();
        return;
      }

      if (status.data.status === 'running') {
        await refreshRuns();
        return;
      }

      window.clearInterval(intervalId);
      setActiveRunId('');
      await refreshRuns();
      await refreshActiveRunContext();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRunId, refreshActiveRunContext, refreshRuns]);

  const handleRunUpdate = useCallback(
    (update: RunUpdateEvent): void => {
      const effects = deriveRunUpdateEffects(update, selectedRunId, activeRunId);

      if (effects.nextSelectedRunId) {
        setSelectedRunId(effects.nextSelectedRunId);
      }

      if (effects.clearActiveRunId) {
        setActiveRunId('');
      }

      if (effects.refreshRuns) {
        void refreshRuns();
      }

      if (effects.refreshStepResults) {
        void refreshStepResults();
      }

      if (effects.refreshBrowserStates) {
        void refreshBrowserStates();
      }

      if (effects.refreshActiveRunContext) {
        void refreshActiveRunContext();
      }

      if (update.message) {
        onMessage(update.message);
      }
    },
    [activeRunId, onMessage, refreshActiveRunContext, refreshBrowserStates, refreshRuns, refreshStepResults, selectedRunId],
  );

  useEffect(() => {
    const unsubscribe = window.qaApi.onRunUpdate((update) => {
      handleRunUpdate(update);
    });

    return () => {
      unsubscribe();
    };
  }, [handleRunUpdate]);

  const handleBrowserInstallUpdate = useCallback(
    (update: BrowserInstallUpdate): void => {
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
    },
    [refreshBrowserStates],
  );

  useEffect(() => {
    const unsubscribe = window.qaApi.onBrowserInstallUpdate((update) => {
      handleBrowserInstallUpdate(update);
    });

    return () => {
      unsubscribe();
    };
  }, [handleBrowserInstallUpdate]);

  const installBrowser = useCallback(
    async (browserName: BrowserName): Promise<void> => {
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
        onMessage(result.error.message);
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
    },
    [onMessage, refreshBrowserStates],
  );

  const startRun = useCallback(async (): Promise<void> => {
    if (!selectedTestId) {
      onMessage('Select a test first.');
      return;
    }

    if (selectedBrowserState && !selectedBrowserState.installed) {
      await installBrowser(browser);
      const statusResult = await window.qaApi.runBrowserStatus();
      if (!statusResult.ok) {
        onMessage(statusResult.error.message);
        return;
      }

      setBrowserStates(statusResult.data);
      const current = statusResult.data.find((state) => state.browser === browser);
      if (!current?.installed) {
        onMessage(`Unable to install ${browser}. Check errors and retry.`);
        return;
      }
    }

    const result = await window.qaApi.runStart({ testCaseId: selectedTestId, browser });
    if (!result.ok) {
      onMessage(result.error.message);
      void refreshBrowserStates();
      return;
    }

    onMessage('Run started.');
    setActiveRunId(result.data.id);
    setSelectedRunId(result.data.id);
    await refreshRuns();
    await refreshStepResults();
    await refreshActiveRunContext();
  }, [
    browser,
    installBrowser,
    onMessage,
    refreshActiveRunContext,
    refreshBrowserStates,
    refreshRuns,
    refreshStepResults,
    selectedBrowserState,
    selectedTestId,
  ]);

  const cancelRun = useCallback(async (): Promise<void> => {
    if (!activeRunId) {
      return;
    }

    const result = await window.qaApi.runCancel(activeRunId);
    if (!result.ok || !result.data) {
      onMessage(result.ok ? 'No active run to cancel.' : result.error.message);
      return;
    }

    onMessage('Run cancelled immediately.');
    setActiveRunId('');
    await refreshRuns();
    await refreshStepResults();
    await refreshActiveRunContext();
  }, [activeRunId, onMessage, refreshActiveRunContext, refreshRuns, refreshStepResults]);

  const clearRunSelectionState = useCallback(() => {
    setSelectedRunId('');
    setActiveRunId('');
    setStepResults([]);
  }, []);

  return {
    runs,
    selectedRunId,
    setSelectedRunId,
    selectedRun,
    stepResults,
    browser,
    setBrowser,
    browserStates,
    browserInstallProgress,
    selectedBrowserState,
    isBrowserStatesLoaded,
    hasInstalledBrowser,
    activeRunId,
    activeRunContext,
    appConfig,
    refreshActiveRunContext,
    refreshRuns,
    refreshStepResults,
    refreshBrowserStates,
    startRun,
    cancelRun,
    installBrowser,
    clearRunSelectionState,
  };
}
