import type { Dispatch, SetStateAction } from 'react';
import type { TestFormState } from '../types';
import {
  dangerButtonClass,
  fieldClass,
  panelClass,
  primaryButtonClass,
  subtleButtonClass,
} from '../uiClasses';

interface TestCaseEditorPanelProps {
  testCasePanelTitle: string;
  testCasePanelDescription: string;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  hasSelectedTest: boolean;
  isSelectedTestDeleteBlocked: boolean;
  selectedTestHasSteps: boolean;
  canStartRun: boolean;
  onBeginCreateTest: () => void;
  onDeleteSelectedTest: () => void;
  onStartRun: () => void;
}

export function TestCaseEditorPanel({
  testCasePanelTitle,
  testCasePanelDescription,
  testForm,
  setTestForm,
  testTitleError,
  hasSelectedTest,
  isSelectedTestDeleteBlocked,
  selectedTestHasSteps,
  canStartRun,
  onBeginCreateTest,
  onDeleteSelectedTest,
  onStartRun,
}: TestCaseEditorPanelProps): JSX.Element {
  return (
    <section className={`${panelClass} space-y-4 bg-[#0f141d]/60`}>
      <div>
        <h2 className="text-[15px] font-semibold text-[#e7eef8]">{testCasePanelTitle}</h2>
        <p className="text-[11px] text-[#9fb1c9]">{testCasePanelDescription}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-semibold text-[#b3c5dd]">
          <span className="mb-2 block">Test Case Title</span>
          <input
            className={fieldClass}
            value={testForm.title}
            onChange={(event) =>
              setTestForm((previous) => ({ ...previous, title: event.target.value }))
            }
            placeholder="Checkout applies promo and captures payment"
          />
          {testTitleError ? (
            <span className="mt-1 block text-[11px] text-danger">{testTitleError}</span>
          ) : null}
        </label>

        <label className="block text-xs font-semibold text-[#b3c5dd]">
          <span className="mb-2 block">Test Type</span>
          <select
            className={fieldClass}
            value={testForm.testType}
            onChange={(event) =>
              setTestForm((previous) => ({
                ...previous,
                testType: event.target.value as TestFormState['testType'],
              }))
            }
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="edge">Edge</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-[#b3c5dd]">
          <span className="mb-2 block">Priority</span>
          <select
            className={fieldClass}
            value={testForm.priority}
            onChange={(event) =>
              setTestForm((previous) => ({
                ...previous,
                priority: event.target.value as TestFormState['priority'],
              }))
            }
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-[#0d1320]/75 px-3 py-2 text-xs font-semibold text-[#b3c5dd]">
          <input
            type="checkbox"
            checked={testForm.isAiGenerated}
            onChange={(event) =>
              setTestForm((previous) => ({
                ...previous,
                isAiGenerated: event.target.checked,
              }))
            }
          />
          AI-generated test idea
        </label>
      </div>

      <div className="rounded-xl border border-[#23344a]/70 bg-[#101826]/75 px-3 py-2 text-[11px] text-[#9fb1c9]">
        <p className="font-semibold text-[#c6d5e9]">Planning mode</p>
        <p className="mt-1">
          Feature planning is active. Step authoring is deferred to a later phase.
        </p>
        <p className="mt-1">
          {selectedTestHasSteps
            ? 'This selected test case already has execution steps and can be run.'
            : 'This selected test case has no execution steps yet.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          className={dangerButtonClass}
          onClick={onDeleteSelectedTest}
          disabled={!hasSelectedTest || isSelectedTestDeleteBlocked}
        >
          Delete Test Case
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={subtleButtonClass} onClick={onBeginCreateTest}>
            Reset Form
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onStartRun}
            disabled={!canStartRun}
          >
            Start Run
          </button>
        </div>
      </div>
    </section>
  );
}
