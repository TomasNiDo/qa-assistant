import type { Dispatch, SetStateAction } from 'react';
import type { TestCase } from '@shared/types';
import type { FeatureFormState } from '../types';
import {
  aiTagClass,
  dangerButtonClass,
  fieldClass,
  fieldLabelClass,
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

function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export function FeaturePlanningPage({
  hasSelectedProject,
  selectedProjectName,
  featureForm,
  setFeatureForm,
  featureFormMode,
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
  const sortedDraftedTests = [...draftedTests].sort((left, right) => {
    return TEST_TYPE_DISPLAY_ORDER[left.testType] - TEST_TYPE_DISPLAY_ORDER[right.testType];
  });

  if (!hasSelectedProject) {
    return (
      <section className={pageSectionClass}>
        <h1 className={pageTitleClass}>Feature Planning Page</h1>
        <p className={pageSubtitleClass}>Select or create a project to start planning features.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FeaturePhaseToggle
          activePhase="planning"
          onChangePhase={onSwitchPhase}
          canOpenExecution={canOpenExecution}
        />
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={pageTitleClass}>Feature Planning Page</h1>
            <p className={pageSubtitleClass}>
              Project: <span className="font-semibold text-foreground">{selectedProjectName}</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotClass(featureAutoSaveStatus)}`}
              aria-hidden="true"
            />
            {featureAutoSaveMessage}
          </span>
        </div>
      </header>

      <section className={`${pageSectionClass} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>
            {featureFormMode === 'create' ? 'New Feature' : 'Feature Details'}
          </h2>
        </div>

        <div className="grid gap-3">
          <label className={fieldLabelClass}>
            <span className="mb-2 block">Title</span>
            <input
              className={fieldClass}
              value={featureForm.title}
              onChange={(event) =>
                setFeatureForm((previous) => ({ ...previous, title: event.target.value }))
              }
              placeholder="Checkout supports promo code stacking"
            />
            {featureTitleError ? (
              <span className="mt-1 block text-[11px] text-danger">{featureTitleError}</span>
            ) : null}
          </label>

          <label className={fieldLabelClass}>
            <span className="mb-2 block">Acceptance Criteria</span>
            <textarea
              className={`${fieldClass} min-h-24 resize-y py-2`}
              value={featureForm.acceptanceCriteria}
              onChange={(event) =>
                setFeatureForm((previous) => ({
                  ...previous,
                  acceptanceCriteria: event.target.value,
                }))
              }
              placeholder="Given a valid cart, when checkout completes, then order confirmation appears."
            />
            {featureAcceptanceCriteriaError ? (
              <span className="mt-1 block text-[11px] text-danger">
                {featureAcceptanceCriteriaError}
              </span>
            ) : null}
          </label>

          <label className={fieldLabelClass}>
            <span className="mb-2 block">Requirements</span>
            <textarea
              className={`${fieldClass} min-h-20 resize-y py-2`}
              value={featureForm.requirements}
              onChange={(event) =>
                setFeatureForm((previous) => ({ ...previous, requirements: event.target.value }))
              }
              placeholder="Optional technical constraints and dependencies."
            />
          </label>

          <label className={fieldLabelClass}>
            <span className="mb-2 block">Notes</span>
            <textarea
              className={`${fieldClass} min-h-20 resize-y py-2`}
              value={featureForm.notes}
              onChange={(event) =>
                setFeatureForm((previous) => ({ ...previous, notes: event.target.value }))
              }
              placeholder="Optional planning notes."
            />
          </label>
        </div>
      </section>

      <section className={pageSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Drafted Test Cases ({sortedDraftedTests.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              onClick={onApproveSelectedDraftedTests}
              disabled={!canManageDraftedTests || selectedDraftedTestIds.length === 0}
            >
              Approved Test Cases
            </button>
            <button
              type="button"
              className={subtleButtonClass}
              onClick={onGenerateAiScenarios}
              disabled={!canManageDraftedTests || isGeneratingAiScenarios}
            >
              {isGeneratingAiScenarios ? 'Generating Scenarios...' : 'Generate Scenarios (AI)'}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onAddTestCase}
              disabled={!canManageDraftedTests}
            >
              Add Test Case
            </button>
          </div>
        </div>

        {!canManageDraftedTests ? (
          <p className={helperTextClass}>
            Save the feature title and acceptance criteria first to add drafted test cases.
          </p>
        ) : sortedDraftedTests.length === 0 ? (
          <p className={helperTextClass}>No drafted test cases yet.</p>
        ) : (
          <ul className="space-y-2">
            {sortedDraftedTests.map((testCase) => (
              <li key={testCase.id} className={listRowClass}>
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
                    <p className="truncate text-[12px] font-semibold text-foreground">{testCase.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className={tagClass}>{formatEnumLabel(testCase.testType)}</span>
                      <span className={tagClass}>{formatEnumLabel(testCase.priority)}</span>
                      {testCase.isAiGenerated ? <span className={aiTagClass}>AI</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={subtleButtonClass}
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
                    className={dangerButtonClass}
                    disabled={isTestDeleteBlocked(testCase.id)}
                    onClick={() => onDeleteTestCase(testCase.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={pageSectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Approved Test Cases ({approvedTests.length})</h2>
        </div>

        {!canManageDraftedTests ? (
          <p className={helperTextClass}>
            Approved cases will appear once the feature and drafted tests are saved.
          </p>
        ) : approvedTests.length === 0 ? (
          <p className={helperTextClass}>No approved test cases yet.</p>
        ) : (
          <ul className="space-y-2">
            {approvedTests.map((testCase) => (
              <li key={testCase.id} className={listRowClass}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">{testCase.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span className={tagClass}>{formatEnumLabel(testCase.testType)}</span>
                    <span className={tagClass}>{formatEnumLabel(testCase.priority)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={subtleButtonClass}
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
                    className={dangerButtonClass}
                    disabled={isTestDeleteBlocked(testCase.id)}
                    onClick={() => onDeleteTestCase(testCase.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
