import type { FeatureExecutionSummary } from '@shared/types';
import {
  helperTextClass,
  listRowClass,
  pageSectionClass,
  pageSubtitleClass,
  pageTitleClass,
  primaryButtonClass,
  sectionTitleClass,
  subtleButtonClass,
  tagClass,
} from '../uiClasses';
import { FeaturePhaseToggle } from './FeaturePhaseToggle';

type ExecutionFilter = 'all' | 'passed' | 'failed' | 'running';

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
  runBlocked: boolean;
}

function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  return 'bg-muted-foreground';
}

function metricCardClass(kind: 'passed' | 'failed' | 'running' | 'coverage'): string {
  if (kind === 'passed') {
    return 'rounded-md border border-success/30 bg-success/10 px-3 py-2';
  }
  if (kind === 'failed') {
    return 'rounded-md border border-danger/30 bg-danger/10 px-3 py-2';
  }
  if (kind === 'running') {
    return 'rounded-md border border-info/30 bg-info/10 px-3 py-2';
  }
  return 'rounded-md border border-border bg-background px-3 py-2';
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
  runBlocked,
}: FeatureExecutionPageProps): JSX.Element {
  if (!hasSelectedProject) {
    return (
      <section className={pageSectionClass}>
        <h1 className={pageTitleClass}>Feature Execution Page</h1>
        <p className={pageSubtitleClass}>
          Select or create a project to start running approved test cases.
        </p>
      </section>
    );
  }

  const filteredTests = (summary?.testCases ?? []).filter((testCase) => {
    if (activeFilter === 'all') {
      return true;
    }
    return testCase.executionStatus === activeFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FeaturePhaseToggle
          activePhase="execution"
          onChangePhase={onSwitchPhase}
          canOpenExecution={canOpenExecution}
        />
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={pageTitleClass}>Feature Execution Page</h1>
            <p className={pageSubtitleClass}>
              Project: <span className="font-semibold text-foreground">{selectedProjectName}</span>
            </p>
          </div>
        </div>
      </header>

      <section className={`${pageSectionClass} space-y-2`}>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Feature Title
        </h2>
        <p className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground">
          {featureTitle.trim() ? featureTitle : 'Untitled feature'}
        </p>
      </section>

      <section className={pageSectionClass}>
        <h2 className={sectionTitleClass}>Execution Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className={metricCardClass('passed')}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-success">Passed</p>
            <p className="mt-1 text-2xl font-semibold text-success">{summary?.passedCount ?? 0}</p>
          </article>
          <article className={metricCardClass('failed')}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-danger">{summary?.failedCount ?? 0}</p>
          </article>
          <article className={metricCardClass('running')}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-info">Running</p>
            <p className="mt-1 text-2xl font-semibold text-info">{summary?.runningCount ?? 0}</p>
          </article>
          <article className={metricCardClass('coverage')}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Coverage</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{summary?.coveragePercent ?? 0}%</p>
            <p className="text-[11px] text-secondary-foreground">
              {summary?.coveredCount ?? 0}/{summary?.totalApproved ?? 0} approved executed
            </p>
          </article>
        </div>
      </section>

      <section className={pageSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitleClass}>Approved Test Cases ({summary?.totalApproved ?? 0})</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'passed', 'failed', 'running'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={activeFilter === filter ? primaryButtonClass : subtleButtonClass}
                onClick={() => onChangeFilter(filter)}
              >
                {formatEnumLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        {filteredTests.length === 0 ? (
          <p className={helperTextClass}>
            {summary?.totalApproved
              ? 'No approved test cases match this filter.'
              : 'No approved test cases yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredTests.map((testCase) => (
              <li key={testCase.id} className={listRowClass}>
                <div className="min-w-0 flex flex-1 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${indicatorClass(testCase.executionStatus)}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{testCase.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className={tagClass}>{formatEnumLabel(testCase.priority)}</span>
                      <span className={tagClass}>{formatEnumLabel(testCase.testType)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={subtleButtonClass}
                    onClick={() => onEditTestCase(testCase.id)}
                  >
                    Edit
                  </button>
                  {testCase.hasSteps ? (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => onRunTestCase(testCase.id)}
                      disabled={runBlocked}
                    >
                      Run
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
