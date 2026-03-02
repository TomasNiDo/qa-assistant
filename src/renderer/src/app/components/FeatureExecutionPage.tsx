import type { FeatureExecutionSummary } from '@shared/types';
import { panelClass, primaryButtonClass, subtleButtonClass } from '../uiClasses';
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
    return 'bg-[#26d26f]';
  }
  if (status === 'failed') {
    return 'bg-[#ff5151]';
  }
  if (status === 'running') {
    return 'bg-[#3a8dff]';
  }
  return 'bg-[#8a93a0]';
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
      <section className={`${panelClass} bg-[#101722]/55`}>
        <h1 className="text-xl font-semibold text-[#edf3fb]">Feature Execution Page</h1>
        <p className="mt-2 text-sm text-[#a9b8cb]">
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
            <h1 className="text-2xl font-semibold text-[#edf3fb]">Feature Execution Page</h1>
            <p className="text-sm text-[#a9b8cb]">
              Project: <span className="font-semibold text-[#d9e4f5]">{selectedProjectName}</span>
            </p>
          </div>
        </div>
      </header>

      <section className={`${panelClass} space-y-2 bg-[#0f141d]/60`}>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#9fb4cf]">
          Feature Title
        </h2>
        <p className="rounded-xl bg-[#101826]/75 px-3 py-2 text-sm font-semibold text-[#dce8f8]">
          {featureTitle.trim() ? featureTitle : 'Untitled feature'}
        </p>
      </section>

      <section className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <h2 className="text-[15px] font-semibold text-[#e7eef8]">Execution Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-[#1e3a55] bg-[#101d2b]/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9fb4cf]">Passed</p>
            <p className="mt-1 text-2xl font-semibold text-[#56dfa5]">
              {summary?.passedCount ?? 0}
            </p>
          </article>
          <article className="rounded-xl border border-[#3f2424] bg-[#221316]/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d9a8a8]">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-[#ff6d6d]">
              {summary?.failedCount ?? 0}
            </p>
          </article>
          <article className="rounded-xl border border-[#1f315a] bg-[#111b31]/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9fb4cf]">Running</p>
            <p className="mt-1 text-2xl font-semibold text-[#4f9eff]">
              {summary?.runningCount ?? 0}
            </p>
          </article>
          <article className="rounded-xl border border-[#2a384d] bg-[#101825]/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9fb4cf]">Coverage</p>
            <p className="mt-1 text-2xl font-semibold text-[#dce8f8]">
              {summary?.coveragePercent ?? 0}%
            </p>
            <p className="text-[11px] text-[#9fb4cf]">
              {summary?.coveredCount ?? 0}/{summary?.totalApproved ?? 0} approved executed
            </p>
          </article>
        </div>
      </section>

      <section className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[#e7eef8]">
            Approved Test Cases ({summary?.totalApproved ?? 0})
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'passed', 'failed', 'running'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={
                  activeFilter === filter
                    ? primaryButtonClass
                    : subtleButtonClass
                }
                onClick={() => onChangeFilter(filter)}
              >
                {formatEnumLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        {filteredTests.length === 0 ? (
          <p className="text-xs text-[#94a8c2]">
            {summary?.totalApproved
              ? 'No approved test cases match this filter.'
              : 'No approved test cases yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredTests.map((testCase) => (
              <li
                key={testCase.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#203244]/60 bg-[#0f1a29]/80 px-3 py-2"
              >
                <div className="min-w-0 flex flex-1 items-center gap-2.5">
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${indicatorClass(
                      testCase.executionStatus,
                    )}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[#dce8f8]">
                      {testCase.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                        {formatEnumLabel(testCase.priority)}
                      </span>
                      <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                        {formatEnumLabel(testCase.testType)}
                      </span>
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
