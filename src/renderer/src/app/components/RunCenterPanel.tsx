import type { BrowserName, Run, StepResult } from '@shared/types';
import { StepResultCard } from './StepResultCard';
import {
  dangerButtonClass,
  fieldClass,
  mutedButtonClass,
  panelClass,
  primaryButtonClass,
} from '../uiClasses';
import { formatRunDuration, runStatusClassName } from '../utils';

interface RunCenterPanelProps {
  selectedTestTitle: string;
  browser: BrowserName;
  setBrowser: (browser: BrowserName) => void;
  canStartRun: boolean;
  activeRunId: string;
  runs: Run[];
  selectedRunId: string;
  setSelectedRunId: (runId: string) => void;
  selectedRun: Run | null;
  stepResults: StepResult[];
  onStartRun: () => void;
  onCancelRun: () => void;
  onGenerateBugReport: () => void;
  isGeneratingBugReport: boolean;
  bugReportVisible: boolean;
  bugReportDraft: string;
  setBugReportDraft: (draft: string) => void;
  onCloseBugReportDraft: () => void;
  onCopyBugReport: () => void;
}

export function RunCenterPanel({
  selectedTestTitle,
  browser,
  setBrowser,
  canStartRun,
  activeRunId,
  runs,
  selectedRunId,
  setSelectedRunId,
  selectedRun,
  stepResults,
  onStartRun,
  onCancelRun,
  onGenerateBugReport,
  isGeneratingBugReport,
  bugReportVisible,
  bugReportDraft,
  setBugReportDraft,
  onCloseBugReportDraft,
  onCopyBugReport,
}: RunCenterPanelProps): JSX.Element {
  return (
    <section className={panelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/75">Run center</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">Execute test and inspect timeline</h2>
          <p className="text-xs text-muted-foreground">Selected test: {selectedTestTitle}</p>
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
            <button type="button" className={primaryButtonClass} onClick={onStartRun} disabled={!canStartRun}>
              Start run
            </button>
            <button type="button" className={dangerButtonClass} onClick={onCancelRun} disabled={!activeRunId}>
              Cancel immediately
            </button>
            <button
              type="button"
              className={mutedButtonClass}
              onClick={onGenerateBugReport}
              disabled={!selectedRun || selectedRun.status !== 'failed' || isGeneratingBugReport}
              aria-busy={isGeneratingBugReport}
            >
              {isGeneratingBugReport ? (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span>Generating report...</span>
                </>
              ) : (
                'Generate bug report'
              )}
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
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${runStatusClassName(run.status)}`}>
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
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${runStatusClassName(selectedRun.status)}`}>
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

      {bugReportVisible ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-border/80 bg-background/55 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold tracking-wide text-foreground">Bug report draft</h3>
            <button type="button" className={mutedButtonClass} onClick={onCloseBugReportDraft}>
              Close
            </button>
          </div>
          <textarea
            className={`${fieldClass} min-h-[240px] resize-y font-mono text-xs`}
            rows={14}
            value={bugReportDraft}
            onChange={(event) => setBugReportDraft(event.target.value)}
          />
          <button type="button" className={mutedButtonClass} onClick={onCopyBugReport}>
            Copy to clipboard
          </button>
        </div>
      ) : null}
    </section>
  );
}
