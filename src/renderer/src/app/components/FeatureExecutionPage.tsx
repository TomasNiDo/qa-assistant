import type { FeatureExecutionSummary, TestPriority, TestType } from '@shared/types';
import { helperTextClass, pageSubtitleClass, pageTitleClass } from '../uiClasses';
import { FeaturePhaseToggle } from './FeaturePhaseToggle';

type ExecutionFilter = 'all' | 'passed' | 'failed' | 'running' | 'not_run';

interface FeatureExecutionPageProps {
  hasSelectedProject: boolean;
  selectedProjectName: string;
  featureTitle: string;
  summary: FeatureExecutionSummary | null;
  activeFilter: ExecutionFilter;
  onChangeFilter: (filter: ExecutionFilter) => void;
  onSwitchPhase: (phase: 'planning' | 'execution') => void;
  canOpenExecution: boolean;
  onEditTestCase: (testCaseId: string) => void;
  onRunTestCase: (testCaseId: string) => void;
  onStopActiveRun: () => void;
  runBlocked: boolean;
}

function filterLabel(value: ExecutionFilter): string {
  if (value === 'not_run') {
    return 'Skipped';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDisplayName(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Unselected';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function indicatorClass(status: 'not_run' | 'passed' | 'failed' | 'running'): string {
  if (status === 'passed') {
    return 'bg-success';
  }
  if (status === 'failed') {
    return 'bg-danger';
  }
  if (status === 'running') {
    return 'bg-info';
  }
  return 'bg-warning';
}

function rowStrokeClass(status: 'not_run' | 'passed' | 'failed' | 'running'): string {
  if (status === 'running') {
    return 'border-info/35';
  }
  if (status === 'failed') {
    return 'border-danger/30';
  }
  return 'border-border';
}

function priorityLabel(priority: TestPriority): string {
  if (priority === 'high') {
    return 'P1';
  }
  if (priority === 'medium') {
    return 'P2';
  }
  return 'P3';
}

function priorityClass(priority: TestPriority): string {
  if (priority === 'high') {
    return 'text-danger';
  }
  if (priority === 'medium') {
    return 'text-warning';
  }
  return 'text-muted-foreground';
}

function typePillClass(testType: TestType): string {
  if (testType === 'positive') {
    return 'border border-info/30 bg-info/10 text-info';
  }
  if (testType === 'negative') {
    return 'border border-danger/30 bg-danger/10 text-danger';
  }
  return 'border border-warning/30 bg-warning/10 text-warning';
}

function statCardClass(kind: 'passed' | 'failed' | 'running' | 'skipped'): string {
  if (kind === 'passed') {
    return 'border-success/20 bg-success/10';
  }
  if (kind === 'failed') {
    return 'border-danger/20 bg-danger/10';
  }
  if (kind === 'running') {
    return 'border-info/20 bg-info/10';
  }
  return 'border-warning/20 bg-warning/10';
}

function iconToneClass(kind: 'passed' | 'failed' | 'running' | 'skipped'): string {
  if (kind === 'passed') {
    return 'text-success';
  }
  if (kind === 'failed') {
    return 'text-danger';
  }
  if (kind === 'running') {
    return 'text-info';
  }
  return 'text-warning';
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`rounded-sm px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
        active
          ? 'bg-foreground text-background'
          : 'border border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function FeatureExecutionPage({
  hasSelectedProject,
  selectedProjectName,
  featureTitle,
  summary,
  activeFilter,
  onChangeFilter,
  onSwitchPhase,
  canOpenExecution,
  onEditTestCase,
  onRunTestCase,
  onStopActiveRun,
  runBlocked,
}: FeatureExecutionPageProps): JSX.Element {
  if (!hasSelectedProject) {
    return (
      <section className="rounded-md border border-border bg-card px-4 py-3">
        <h1 className={pageTitleClass}>Feature Execution Page</h1>
        <p className={pageSubtitleClass}>Select or create a project to start running approved test cases.</p>
      </section>
    );
  }

  const totalApproved = summary?.totalApproved ?? 0;
  const passedCount = summary?.passedCount ?? 0;
  const failedCount = summary?.failedCount ?? 0;
  const runningCount = summary?.runningCount ?? 0;
  const coveredCount = summary?.coveredCount ?? 0;
  const skippedCount = Math.max(totalApproved - passedCount - failedCount - runningCount, 0);
  const passRate = totalApproved === 0 ? 0 : Math.round((passedCount / totalApproved) * 100);

  const tests = summary?.testCases ?? [];
  const filteredTests = tests.filter((testCase) => {
    if (activeFilter === 'all') {
      return true;
    }
    return testCase.executionStatus === activeFilter;
  });

  const projectDisplayName = formatDisplayName(selectedProjectName);
  const headerStateLabel = runningCount > 0 ? 'running' : 'idle';
  const activityLabel =
    runningCount > 0
      ? `${runningCount} run${runningCount === 1 ? '' : 's'} in progress`
      : coveredCount > 0
        ? 'results synced recently'
        : 'no runs yet';

  const progressDenominator = Math.max(totalApproved, 1);
  const progressSegments = [
    { kind: 'passed', width: (passedCount / progressDenominator) * 100, className: 'bg-success' },
    { kind: 'failed', width: (failedCount / progressDenominator) * 100, className: 'bg-danger' },
    { kind: 'skipped', width: (skippedCount / progressDenominator) * 100, className: 'bg-warning' },
    { kind: 'running', width: (runningCount / progressDenominator) * 100, className: 'bg-info' },
  ].filter((segment) => segment.width > 0);

  const runHistoryRows = [
    {
      key: 'latest',
      tone: 'border-success/20',
      dot: 'bg-success',
      idLabel: '#Latest',
      detail: `${passedCount}/${totalApproved} passed`,
      meta: runningCount > 0 ? 'live' : 'recent',
    },
    {
      key: 'failed',
      tone: 'border-border',
      dot: 'bg-danger',
      idLabel: '#Failures',
      detail: `${failedCount} failing scenarios`,
      meta: failedCount > 0 ? 'needs review' : 'stable',
    },
    {
      key: 'pending',
      tone: 'border-border',
      dot: 'bg-warning',
      idLabel: '#Pending',
      detail: `${skippedCount} not run`,
      meta: skippedCount > 0 ? 'queued' : 'none',
    },
  ];

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border-b border-border-divider px-2 pb-2">
        <FeaturePhaseToggle
          activePhase="execution"
          onChangePhase={onSwitchPhase}
          canOpenExecution={canOpenExecution}
        />
      </div>

      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">{projectDisplayName} /</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-base font-semibold text-foreground">
                {featureTitle.trim() ? featureTitle : 'Untitled feature'}
              </h1>
              <span className="rounded-sm border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                {headerStateLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">{activityLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/55 bg-danger px-3.5 py-2 text-[11px] font-semibold text-danger-foreground transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onStopActiveRun}
              disabled={!runBlocked}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" fill="currentColor" />
              </svg>
              Stop All
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-success/60 bg-primary px-3.5 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35 disabled:cursor-not-allowed disabled:opacity-55"
              disabled
              title="Bulk execution is not available yet."
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M8 6l10 6-10 6z" fill="currentColor" />
              </svg>
              Run All Tests
            </button>
          </div>
        </header>

        <section className="space-y-2 rounded-md border border-border-divider bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {([
              ['passed', passedCount],
              ['failed', failedCount],
              ['skipped', skippedCount],
              ['running', runningCount],
            ] as const).map(([kind, count]) => (
              <div
                key={kind}
                className={`flex items-center gap-2 rounded-sm border px-3 py-2 ${statCardClass(kind)}`}
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${iconToneClass(kind)}`} aria-hidden="true">
                  {kind === 'passed' ? (
                    <path
                      d="M5 12l4 4L19 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {kind === 'failed' ? (
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {kind === 'running' ? (
                    <path
                      d="M12 4a8 8 0 108 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {kind === 'skipped' ? (
                    <path
                      d="M6 12h12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                </svg>
                <div className="leading-tight">
                  <p className={`text-sm font-semibold ${iconToneClass(kind)}`}>{count}</p>
                  <p className="text-[9px] text-muted-foreground">{kind}</p>
                </div>
              </div>
            ))}
            <div className="grow" />
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M12 7v5l3 2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.9" />
              </svg>
              {coveredCount}/{totalApproved} covered
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px]">
              <strong className="text-sm font-semibold text-success">{passRate}%</strong>
              <span className="text-muted-foreground">pass rate</span>
            </span>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-sm bg-muted">
            <div className="flex h-full w-full">
              {progressSegments.map((segment) => (
                <span
                  key={segment.kind}
                  className={segment.className}
                  style={{ width: `${segment.width}%` }}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <section className="flex min-h-0 flex-1 flex-col space-y-2 rounded-md border border-border-divider bg-card px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[13px] font-semibold text-foreground">Test Cases</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {totalApproved}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {(['all', 'passed', 'failed', 'running', 'not_run'] as const).map((filter) => (
                  <FilterButton
                    key={filter}
                    active={activeFilter === filter}
                    label={filterLabel(filter)}
                    onClick={() => onChangeFilter(filter)}
                  />
                ))}
              </div>
            </div>

            {filteredTests.length === 0 ? (
              <p className={helperTextClass}>
                {totalApproved > 0 ? 'No approved test cases match this filter.' : 'No approved test cases yet.'}
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {filteredTests.map((testCase) => (
                  <li
                    key={testCase.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-background px-2.5 py-2 ${rowStrokeClass(testCase.executionStatus)}`}
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${indicatorClass(testCase.executionStatus)}`}
                        aria-hidden="true"
                      />
                      <p className="truncate text-[11px] text-foreground">{testCase.title}</p>
                      <span className={`shrink-0 text-[9px] font-semibold ${priorityClass(testCase.priority)}`}>
                        {priorityLabel(testCase.priority)}
                      </span>
                      <span
                        className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[8px] font-semibold lowercase ${typePillClass(testCase.testType)}`}
                      >
                        {testCase.testType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        onClick={() => onEditTestCase(testCase.id)}
                        aria-label={`Edit ${testCase.title}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                          <path
                            d="M4 20h4l10-10-4-4L4 16v4zm11-13l2 2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {testCase.hasSteps ? (
                        <button
                          type="button"
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 ${
                            testCase.executionStatus === 'running'
                              ? 'text-danger hover:bg-danger/12'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => onRunTestCase(testCase.id)}
                          aria-label={
                            testCase.executionStatus === 'running'
                              ? `Stop ${testCase.title}`
                              : `Run ${testCase.title}`
                          }
                          disabled={runBlocked}
                        >
                          <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                            {testCase.executionStatus === 'running' ? (
                              <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                            ) : (
                              <path d="M8 6l10 6-10 6z" fill="currentColor" />
                            )}
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-md border border-border-divider bg-card p-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true">
                  <path
                    d="M7 10l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Run History</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                  {coveredCount} tracked
                </span>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {runHistoryRows.map((row) => (
                <div
                  key={row.key}
                  className={`flex items-center gap-2 rounded-sm border bg-background px-2.5 py-2 ${row.tone}`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[10px] font-semibold text-foreground">{row.idLabel}</p>
                    <p className="truncate text-[9px] text-muted-foreground">{row.detail}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground">{row.meta}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
