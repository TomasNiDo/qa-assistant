import type { Dispatch, SetStateAction } from 'react';
import type { TestCase } from '@shared/types';
import type { FeatureFormState } from '../types';
import {
  dangerButtonClass,
  fieldClass,
  panelClass,
  primaryButtonClass,
  subtleButtonClass,
} from '../uiClasses';

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
  draftedTests: TestCase[];
  approvedTests: TestCase[];
  selectedDraftedTestIds: string[];
  canManageDraftedTests: boolean;
  isTestDeleteBlocked: (testCaseId: string) => boolean;
  onAddTestCase: () => void;
  onToggleDraftedSelection: (testCaseId: string, checked: boolean) => void;
  onApproveDraftedTestCase: (testCaseId: string) => void;
  onApproveSelectedDraftedTests: () => void;
  onMoveBackApprovedTestCase: (testCaseId: string) => void;
  onDeleteTestCase: (testCaseId: string) => void;
}

function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  draftedTests,
  approvedTests,
  selectedDraftedTestIds,
  canManageDraftedTests,
  isTestDeleteBlocked,
  onAddTestCase,
  onToggleDraftedSelection,
  onApproveDraftedTestCase,
  onApproveSelectedDraftedTests,
  onMoveBackApprovedTestCase,
  onDeleteTestCase,
}: FeaturePlanningPageProps): JSX.Element {
  if (!hasSelectedProject) {
    return (
      <section className={`${panelClass} bg-[#101722]/55`}>
        <h1 className="text-xl font-semibold text-[#edf3fb]">Feature Planning Page</h1>
        <p className="mt-2 text-sm text-[#a9b8cb]">
          Select or create a project to start planning features.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#edf3fb]">Feature Planning Page</h1>
          <p className="text-sm text-[#a9b8cb]">
            Project: <span className="font-semibold text-[#d9e4f5]">{selectedProjectName}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#121c2a]/75 px-3 py-1.5 text-xs font-semibold text-[#d9e4f5]">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              featureAutoSaveStatus === 'saving'
                ? 'animate-pulse bg-warning'
                : featureAutoSaveStatus === 'error'
                  ? 'bg-danger'
                  : 'bg-success'
            }`}
            aria-hidden="true"
          />
          {featureAutoSaveMessage}
        </span>
      </header>

      <section className={`${panelClass} space-y-4 bg-[#0f141d]/60`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#e7eef8]">
            {featureFormMode === 'create' ? 'New Feature' : 'Feature Details'}
          </h2>
        </div>

        <div className="grid gap-3">
          <label className="block text-xs font-semibold text-[#b3c5dd]">
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

          <label className="block text-xs font-semibold text-[#b3c5dd]">
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

          <label className="block text-xs font-semibold text-[#b3c5dd]">
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

          <label className="block text-xs font-semibold text-[#b3c5dd]">
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

      <section className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#e7eef8]">Drafted Test Cases</h2>
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
              className={primaryButtonClass}
              onClick={onAddTestCase}
              disabled={!canManageDraftedTests}
            >
              Add Test Case
            </button>
          </div>
        </div>

        {!canManageDraftedTests ? (
          <p className="text-xs text-[#94a8c2]">
            Save the feature title and acceptance criteria first to add drafted test cases.
          </p>
        ) : draftedTests.length === 0 ? (
          <p className="text-xs text-[#94a8c2]">No drafted test cases yet.</p>
        ) : (
          <ul className="space-y-2">
            {draftedTests.map((testCase) => (
              <li
                key={testCase.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0f1a29]/80 px-3 py-2"
              >
                <div className="min-w-0 flex flex-1 items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 accent-[#5eb0ff]"
                    checked={selectedDraftedTestIds.includes(testCase.id)}
                    onChange={(event) =>
                      onToggleDraftedSelection(testCase.id, event.target.checked)
                    }
                    aria-label={`Select ${testCase.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#dce8f8]">
                      {testCase.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                      <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                        {formatEnumLabel(testCase.testType)}
                      </span>
                      <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                        {formatEnumLabel(testCase.priority)}
                      </span>
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

      <section className={`${panelClass} space-y-3 bg-[#0f141d]/60`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#e7eef8]">Approved Test Cases</h2>
        </div>

        {!canManageDraftedTests ? (
          <p className="text-xs text-[#94a8c2]">
            Approved cases will appear once the feature and drafted tests are saved.
          </p>
        ) : approvedTests.length === 0 ? (
          <p className="text-xs text-[#94a8c2]">No approved test cases yet.</p>
        ) : (
          <ul className="space-y-2">
            {approvedTests.map((testCase) => (
              <li
                key={testCase.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0f1a29]/80 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#dce8f8]">{testCase.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                      {formatEnumLabel(testCase.testType)}
                    </span>
                    <span className="rounded-full bg-[#17314f]/85 px-2 py-1 text-[#9fd1ff]">
                      {formatEnumLabel(testCase.priority)}
                    </span>
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
