import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { TestCase } from '@shared/types';
import type { FeatureFormState } from '../types';
import {
  helperTextClass,
  pageSubtitleClass,
  primaryButtonClass,
  sectionTitleClass,
  subtleButtonClass,
} from '../uiClasses';
import { FeaturePhaseToggle } from './FeaturePhaseToggle';

interface FeaturePlanningPageProps {
  hasSelectedProject: boolean;
  selectedProjectName: string;
  featureForm: FeatureFormState;
  setFeatureForm: Dispatch<SetStateAction<FeatureFormState>>;
  featureFormMode: 'create' | 'edit';
  featureTitleError: string | null;
  featureAcceptanceCriteriaError: string | null;
  featureAutoSaveStatus: 'saving' | 'saved' | 'error';
  featureAutoSaveMessage: string;
  onSwitchPhase: (phase: 'planning' | 'execution') => void;
  canOpenExecution: boolean;
  draftedTests: TestCase[];
  approvedTests: TestCase[];
  selectedDraftedTestIds: string[];
  canManageDraftedTests: boolean;
  isTestDeleteBlocked: (testCaseId: string) => boolean;
  onAddTestCase: () => void;
  onGenerateAiScenarios: () => void;
  isGeneratingAiScenarios: boolean;
  onToggleDraftedSelection: (testCaseId: string, checked: boolean) => void;
  onApproveDraftedTestCase: (testCaseId: string) => void;
  onApproveSelectedDraftedTests: () => void;
  onMoveBackApprovedTestCase: (testCaseId: string) => void;
  onDeleteTestCase: (testCaseId: string) => void;
}

const TEST_TYPE_DISPLAY_ORDER: Record<TestCase['testType'], number> = {
  positive: 0,
  negative: 1,
  edge: 2,
};

const PRIORITY_ORDER: Record<TestCase['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type PlanningTab = 'acceptance' | 'requirements' | 'notes';
type DraftedFilter = 'all' | TestCase['testType'];
type ApprovedSortDirection = 'asc' | 'desc';
type ApprovedSortField = 'priority' | 'testType';

function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDisplayName(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Unselected';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function statusDotClass(status: 'saving' | 'saved' | 'error'): string {
  if (status === 'saving') {
    return 'animate-pulse bg-warning';
  }
  if (status === 'error') {
    return 'bg-danger';
  }
  return 'bg-success';
}

function draftedTypeTagClass(testType: TestCase['testType']): string {
  if (testType === 'positive') {
    return 'inline-flex items-center rounded-sm bg-success/12 px-1.5 py-0.5 text-[9px] font-medium text-success';
  }
  if (testType === 'negative') {
    return 'inline-flex items-center rounded-sm bg-danger/12 px-1.5 py-0.5 text-[9px] font-medium text-danger';
  }
  return 'inline-flex items-center rounded-sm bg-warning/12 px-1.5 py-0.5 text-[9px] font-medium text-warning';
}

function priorityTagClass(priority: TestCase['priority']): string {
  if (priority === 'high') {
    return 'inline-flex items-center rounded-sm bg-danger/12 px-1.5 py-0.5 text-[9px] font-medium text-danger';
  }
  if (priority === 'medium') {
    return 'inline-flex items-center rounded-sm bg-warning/12 px-1.5 py-0.5 text-[9px] font-medium text-warning';
  }
  return 'inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground';
}

function aiTagClass(): string {
  return 'inline-flex items-center gap-1 rounded-sm bg-purple/12 px-1.5 py-0.5 text-[9px] font-medium text-purple';
}

function rowIconButtonClass(kind: 'approve' | 'neutral'): string {
  if (kind === 'approve') {
    return 'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-success/30 bg-success/12 text-success transition-colors hover:bg-success/18';
  }

  return 'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:text-secondary-foreground hover:border-border-strong';
}

function countPillClass(): string {
  return 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-secondary-foreground';
}

function draftedCountPillClass(): string {
  return 'inline-flex items-center rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-semibold text-warning';
}

export function FeaturePlanningPage({
  hasSelectedProject,
  selectedProjectName,
  featureForm,
  setFeatureForm,
  featureTitleError,
  featureAcceptanceCriteriaError,
  featureAutoSaveStatus,
  featureAutoSaveMessage,
  onSwitchPhase,
  canOpenExecution,
  draftedTests,
  approvedTests,
  selectedDraftedTestIds,
  canManageDraftedTests,
  isTestDeleteBlocked,
  onAddTestCase,
  onGenerateAiScenarios,
  isGeneratingAiScenarios,
  onToggleDraftedSelection,
  onApproveDraftedTestCase,
  onApproveSelectedDraftedTests,
  onMoveBackApprovedTestCase,
  onDeleteTestCase,
}: FeaturePlanningPageProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<PlanningTab>('acceptance');
  const [draftedFilter, setDraftedFilter] = useState<DraftedFilter>('all');
  const [approvedFilter, setApprovedFilter] = useState<DraftedFilter>('all');
  const [approvedSortField, setApprovedSortField] = useState<ApprovedSortField | ''>('');
  const [approvedSortDirection, setApprovedSortDirection] = useState<ApprovedSortDirection>('asc');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const projectDisplayName = useMemo(
    () => formatDisplayName(selectedProjectName),
    [selectedProjectName],
  );

  const sortedDraftedTests = useMemo(
    () =>
      [...draftedTests].sort((left, right) => {
        if (TEST_TYPE_DISPLAY_ORDER[left.testType] !== TEST_TYPE_DISPLAY_ORDER[right.testType]) {
          return TEST_TYPE_DISPLAY_ORDER[left.testType] - TEST_TYPE_DISPLAY_ORDER[right.testType];
        }

        return left.title.localeCompare(right.title);
      }),
    [draftedTests],
  );

  const filteredDraftedTests = useMemo(
    () =>
      sortedDraftedTests.filter((testCase) => {
        if (draftedFilter === 'all') {
          return true;
        }

        return testCase.testType === draftedFilter;
      }),
    [draftedFilter, sortedDraftedTests],
  );

  const sortedApprovedTests = useMemo(() => {
    if (!approvedSortField) {
      return approvedTests;
    }

    const rows = [...approvedTests].sort((left, right) => {
      if (approvedSortField === 'priority') {
        if (PRIORITY_ORDER[left.priority] !== PRIORITY_ORDER[right.priority]) {
          return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        }
      } else if (TEST_TYPE_DISPLAY_ORDER[left.testType] !== TEST_TYPE_DISPLAY_ORDER[right.testType]) {
        return TEST_TYPE_DISPLAY_ORDER[left.testType] - TEST_TYPE_DISPLAY_ORDER[right.testType];
      }

      return left.title.localeCompare(right.title);
    });

    return approvedSortDirection === 'asc' ? rows : rows.reverse();
  }, [approvedSortDirection, approvedSortField, approvedTests]);

  const filteredApprovedTests = useMemo(
    () =>
      sortedApprovedTests.filter((testCase) => {
        if (approvedFilter === 'all') {
          return true;
        }

        return testCase.testType === approvedFilter;
      }),
    [approvedFilter, sortedApprovedTests],
  );

  const allFilteredDraftedSelected =
    filteredDraftedTests.length > 0 &&
    filteredDraftedTests.every((testCase) => selectedDraftedTestIds.includes(testCase.id));

  const selectedDraftedCount = selectedDraftedTestIds.length;
  const activeTabValue =
    activeTab === 'acceptance'
      ? featureForm.acceptanceCriteria
      : activeTab === 'requirements'
        ? featureForm.requirements
        : featureForm.notes;
  const activeTabPlaceholder =
    activeTab === 'acceptance'
      ? '- User can complete checkout with valid card\n- Payment failures show actionable message'
      : activeTab === 'requirements'
        ? 'Optional technical constraints and dependencies.'
        : 'Optional planning notes.';

  if (!hasSelectedProject) {
    return (
      <section className="space-y-3 rounded-md border border-border bg-card px-4 py-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feature Planning Page</h1>
        <p className={pageSubtitleClass}>Select or create a project to start planning features.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border-b border-border-divider px-2 pb-2">
        <FeaturePhaseToggle
          activePhase="planning"
          onChangePhase={onSwitchPhase}
          canOpenExecution={canOpenExecution}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{projectDisplayName} /</span>
            <input
              ref={titleInputRef}
              aria-label="Feature title"
              className="min-w-[320px] flex-1 border-0 bg-transparent px-0 py-0 text-[26px] font-semibold leading-none text-foreground outline-none"
              value={featureForm.title}
              onChange={(event) =>
                setFeatureForm((previous) => ({ ...previous, title: event.target.value }))
              }
              placeholder="Checkout supports promo code stacking"
              title={featureForm.title}
            />
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-secondary-foreground"
              aria-label="Edit feature title"
              onClick={() => titleInputRef.current?.focus()}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.42L18.38 3.3a1 1 0 00-1.42 0l-1.83 1.83l3.75 3.75L20.7 7.04z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusDotClass(featureAutoSaveStatus)}`}
              aria-hidden="true"
            />
            {featureAutoSaveMessage}
          </span>
        </div>

        {featureTitleError ? <p className="text-[11px] text-danger">{featureTitleError}</p> : null}

        <div className="flex items-center gap-4 text-[11px] text-secondary-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            {approvedTests.length} approved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger" />
            {draftedTests.length} drafted
          </span>
        </div>

      </section>

      <section className="space-y-3">
        <div className="rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className={`border-b-2 px-1 py-3 text-[11px] ${
                  activeTab === 'acceptance'
                    ? 'border-success text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => setActiveTab('acceptance')}
              >
                Acceptance Criteria
              </button>
              <button
                type="button"
                className={`border-b-2 px-1 py-3 text-[11px] ${
                  activeTab === 'requirements'
                    ? 'border-success text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => setActiveTab('requirements')}
              >
                Requirements
              </button>
              <button
                type="button"
                className={`border-b-2 px-1 py-3 text-[11px] ${
                  activeTab === 'notes'
                    ? 'border-success text-foreground'
                    : 'border-transparent text-muted-foreground'
                }`}
                onClick={() => setActiveTab('notes')}
              >
                Notes
              </button>
            </div>

            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-secondary-foreground"
              aria-label="Collapse details section"
              title="Collapse details section"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M7 14l5-5l5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="px-4 pt-4">
            <textarea
              aria-label={`${formatEnumLabel(activeTab)} content`}
              className="min-h-[168px] w-full resize-y border-0 bg-transparent p-0 text-[12px] leading-5 text-secondary-foreground outline-none placeholder:text-muted-foreground"
              value={activeTabValue}
              onChange={(event) =>
                setFeatureForm((previous) =>
                  activeTab === 'acceptance'
                    ? { ...previous, acceptanceCriteria: event.target.value }
                    : activeTab === 'requirements'
                      ? { ...previous, requirements: event.target.value }
                      : { ...previous, notes: event.target.value },
                )
              }
              placeholder={activeTabPlaceholder}
            />
            {activeTab === 'acceptance' && featureAcceptanceCriteriaError ? (
              <p className="mt-1 text-[11px] text-danger">{featureAcceptanceCriteriaError}</p>
            ) : null}
          </div>

          <div className="flex justify-end px-4 pb-4 pt-3">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onGenerateAiScenarios}
              disabled={!canManageDraftedTests || isGeneratingAiScenarios}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M12 3l1.7 4.7L18.5 9l-4.8 1.3L12 15l-1.7-4.7L5.5 9l4.8-1.3L12 3zm6.5 11.5l.8 2.2l2.2.8l-2.2.8l-.8 2.2l-.8-2.2l-2.2-.8l2.2-.8l.8-2.2zM4.5 14l.8 2.2l2.2.8l-2.2.8l-.8 2.2l-.8-2.2l-2.2-.8l2.2-.8l.8-2.2z"
                  fill="currentColor"
                />
              </svg>
              {isGeneratingAiScenarios ? 'Generating Scenarios...' : 'Generate Scenarios'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="flex min-h-[320px] flex-col rounded-md border border-border bg-card p-3">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <h2 className={`${sectionTitleClass} flex items-center gap-2`}>
              Drafted Test Cases
              <span className={draftedCountPillClass()} aria-label={`Drafted count: ${sortedDraftedTests.length}`}>
                {sortedDraftedTests.length}
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={subtleButtonClass}
                onClick={() => {
                  const nextChecked = !allFilteredDraftedSelected;
                  filteredDraftedTests.forEach((testCase) => {
                    onToggleDraftedSelection(testCase.id, nextChecked);
                  });
                }}
                disabled={!canManageDraftedTests || filteredDraftedTests.length === 0}
              >
                {allFilteredDraftedSelected ? 'Clear all' : 'Select all'}
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={onApproveSelectedDraftedTests}
                disabled={!canManageDraftedTests || selectedDraftedCount === 0}
              >
                Approve
              </button>
            </div>
          </div>

          <div className="mt-2 flex min-h-8 items-center gap-1.5">
            {(['all', 'positive', 'negative', 'edge'] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                className={`rounded-sm border px-2 py-0.5 text-[10px] transition-colors ${
                  draftedFilter === filterKey
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:text-secondary-foreground'
                }`}
                onClick={() => setDraftedFilter(filterKey)}
              >
                {formatEnumLabel(filterKey)}
              </button>
            ))}
          </div>

          {!canManageDraftedTests ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Save the feature title and acceptance criteria first to add drafted test cases.
            </p>
          ) : filteredDraftedTests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No drafted test cases yet.</p>
          ) : (
            <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
              {filteredDraftedTests.map((testCase) => (
                <li key={testCase.id} className="flex items-start justify-between gap-2 rounded-sm border border-border bg-background px-2.5 py-2">
                  <div className="min-w-0 flex flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-3.5 w-3.5 accent-success"
                      checked={selectedDraftedTestIds.includes(testCase.id)}
                      onChange={(event) =>
                        onToggleDraftedSelection(testCase.id, event.target.checked)
                      }
                      aria-label={`Select ${testCase.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold leading-5 whitespace-normal break-words text-foreground">
                        {testCase.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={draftedTypeTagClass(testCase.testType)}>
                          {formatEnumLabel(testCase.testType)}
                        </span>
                        <span className={priorityTagClass(testCase.priority)}>
                          {testCase.priority === 'high'
                            ? 'P1'
                            : testCase.priority === 'medium'
                              ? 'P2'
                              : 'P3'}
                        </span>
                        {testCase.isAiGenerated ? (
                          <span className={aiTagClass()}>
                            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden="true">
                              <path
                                d="M12 3l1.7 4.7L18.5 9l-4.8 1.3L12 15l-1.7-4.7L5.5 9l4.8-1.3L12 3z"
                                fill="currentColor"
                              />
                            </svg>
                            AI
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      className={rowIconButtonClass('approve')}
                      onClick={() => onApproveDraftedTestCase(testCase.id)}
                      aria-label={`Approve ${testCase.title}`}
                      title="Approve test case"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M20 6L9 17l-5-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={rowIconButtonClass('neutral')}
                      disabled={isTestDeleteBlocked(testCase.id)}
                      onClick={() => onDeleteTestCase(testCase.id)}
                      aria-label="Delete"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-[10px] text-muted-foreground">{selectedDraftedCount} selected</span>
            <button
              type="button"
              className={subtleButtonClass}
              onClick={onAddTestCase}
              disabled={!canManageDraftedTests}
            >
              Add Test Case
            </button>
          </div>
        </article>

        <article className="flex min-h-[320px] flex-col rounded-md border border-border bg-card p-3">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <h2 className={`${sectionTitleClass} flex items-center gap-2`}>
              Approved Test Cases
              <span className={countPillClass()} aria-label={`Approved count: ${approvedTests.length}`}>
                {approvedTests.length}
              </span>
            </h2>

            <div
              className="inline-flex h-8 items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[10px] text-secondary-foreground transition-colors hover:border-border-strong"
              aria-label="Approved sorting"
              title="Sort approved test cases"
            >
              <span>Sort:</span>
              <select
                aria-label="Approved sort field"
                className="h-6 border-0 bg-transparent pr-4 text-[10px] text-secondary-foreground outline-none"
                value={approvedSortField}
                onChange={(event) => {
                  const nextField = event.target.value as ApprovedSortField | '';
                  setApprovedSortField(nextField);
                  setApprovedSortDirection('asc');
                }}
              >
                <option value=""> </option>
                <option value="priority">Priority</option>
                <option value="testType">Test type</option>
              </select>
              {approvedSortField ? (
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-secondary-foreground transition-colors hover:bg-muted"
                  onClick={() =>
                    setApprovedSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
                  }
                  aria-label="Toggle approved sort direction"
                  title={
                    approvedSortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'
                  }
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
                    {approvedSortDirection === 'asc' ? (
                      <path d="M12 7l-4 4h8l-4-4z" fill="currentColor" />
                    ) : (
                      <path d="M12 17l4-4H8l4 4z" fill="currentColor" />
                    )}
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex min-h-8 items-center gap-1.5">
            {(['all', 'positive', 'negative', 'edge'] as const).map((filterKey) => (
              <button
                key={`approved-${filterKey}`}
                type="button"
                className={`rounded-sm border px-2 py-0.5 text-[10px] transition-colors ${
                  approvedFilter === filterKey
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:text-secondary-foreground'
                }`}
                onClick={() => setApprovedFilter(filterKey)}
              >
                {formatEnumLabel(filterKey)}
              </button>
            ))}
          </div>

          {!canManageDraftedTests ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Approved cases will appear once the feature and drafted tests are saved.
            </p>
          ) : approvedTests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No approved test cases yet.</p>
          ) : filteredApprovedTests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No approved test cases match this filter.</p>
          ) : (
            <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
              {filteredApprovedTests.map((testCase) => (
                <li key={testCase.id} className="flex items-start justify-between gap-2 rounded-sm border border-border bg-background px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold leading-5 whitespace-normal break-words text-foreground">
                      {testCase.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={draftedTypeTagClass(testCase.testType)}>
                        {formatEnumLabel(testCase.testType)}
                      </span>
                      <span className={priorityTagClass(testCase.priority)}>
                        {testCase.priority === 'high'
                          ? 'P1'
                          : testCase.priority === 'medium'
                            ? 'P2'
                            : 'P3'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      className={rowIconButtonClass('neutral')}
                      onClick={() => onMoveBackApprovedTestCase(testCase.id)}
                      aria-label={`Move ${testCase.title} back to drafted`}
                      title="Move back to drafted"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={rowIconButtonClass('neutral')}
                      disabled={isTestDeleteBlocked(testCase.id)}
                      onClick={() => onDeleteTestCase(testCase.id)}
                      aria-label="Delete"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t border-border pt-2">
            <p className={helperTextClass}>Approved scenarios are ready for execution mode.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
