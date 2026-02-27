import type { Run, StepResult } from '@shared/types';
import { StepResultCard } from './StepResultCard';
import { dangerButtonClass, mutedButtonClass, panelClass } from '../uiClasses';
import { formatRunDuration, runStatusClassName } from '../utils';

interface RunCenterPanelProps {
  runs: Run[];
  selectedRunId: string;
  setSelectedRunId: (runId: string) => void;
  selectedRun: Run | null;
  stepResults: StepResult[];
  activeRunId: string;
  onCancelRun: () => void;
  onRerun: () => void;
  canRerun: boolean;
  onGenerateBugReport: () => void;
  isGeneratingBugReport: boolean;
  canGenerateBugReport: boolean;
}

function formatRunTimeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RunCenterPanel({
  runs,
  selectedRunId,
  setSelectedRunId,
  selectedRun,
  stepResults,
  activeRunId,
  onCancelRun,
  onRerun,
  canRerun,
  onGenerateBugReport,
  isGeneratingBugReport,
  canGenerateBugReport,
}: RunCenterPanelProps): JSX.Element {
  const selectedStatusClass = selectedRun ? runStatusClassName(selectedRun.status) : 'bg-secondary/70 text-muted-foreground';
  const passedStepsCount = stepResults.filter((result) => result.status === 'passed').length;
  const hasScreenshots = stepResults.some((result) => Boolean(result.screenshotPath));

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <div>
          <h2 className="text-[15px] font-semibold text-[#eaf1fb]">Run Timeline</h2>
          <p className="text-[11px] text-[#9db0c8]">Select a run to inspect step evidence and timing details.</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {runs.length === 0 ? <p className="text-[11px] text-muted-foreground">No runs yet.</p> : null}
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                run.id === selectedRunId
                  ? 'bg-primary/26 text-[#9fdcff]'
                  : runStatusClassName(run.status)
              }`}
              onClick={() => setSelectedRunId(run.id)}
            >
              {formatRunTimeLabel(run.startedAt)} {run.status.toUpperCase()}
            </button>
          ))}
        </div>

        {selectedRun ? (
          <div className="space-y-3 rounded-[10px] bg-[#0f1622]/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#dce4ef]">Focused Run · {formatRunTimeLabel(selectedRun.startedAt)}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedStatusClass}`}>
                {selectedRun.status.toUpperCase()} · {formatRunDuration(selectedRun)} · {selectedRun.browser}
              </span>
            </div>

            <div className="space-y-2">
              {stepResults.length === 0 ? <p className="text-[11px] text-muted-foreground">No step results available.</p> : null}
              {stepResults.map((result) => (
                <StepResultCard key={result.id} result={result} compact />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <aside className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#eaf1fb]">Latest Result</h2>
          {selectedRun ? (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedStatusClass}`}>
              {selectedRun.status.toUpperCase()} · {passedStepsCount}/{stepResults.length || 0} steps
            </span>
          ) : null}
        </div>

        {selectedRun ? (
          <div className="space-y-1 text-xs text-[#b2c1d4]">
            <p>Browser: {selectedRun.browser}</p>
            <p>Duration: {formatRunDuration(selectedRun)}</p>
            <p>Run ID: {selectedRun.id}</p>
            <p>Screenshot: {hasScreenshots ? 'Available' : 'Not captured'}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select a run to view details.</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <span className="rounded-full bg-[#182231]/80 px-2 py-1 text-[11px] font-semibold text-[#c8d8ed]">
            View Logs
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              hasScreenshots
                ? 'bg-[#182231]/80 text-[#c8d8ed]'
                : 'bg-[#121a28]/65 text-[#7f95b1]'
            }`}
          >
            View Screenshot
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {activeRunId ? (
            <button type="button" className={dangerButtonClass} onClick={onCancelRun}>
              Cancel Immediately
            </button>
          ) : null}
          <button
            type="button"
            className={mutedButtonClass}
            onClick={onRerun}
            disabled={!canRerun || Boolean(activeRunId)}
          >
            Re-run
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onGenerateBugReport}
            disabled={!canGenerateBugReport || isGeneratingBugReport}
          >
            {isGeneratingBugReport ? 'Generating...' : 'Report Issue'}
          </button>
        </div>
      </aside>
    </section>
  );
}
