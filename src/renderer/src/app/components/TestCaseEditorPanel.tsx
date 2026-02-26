import type { Dispatch, SetStateAction } from 'react';
import type { BrowserName } from '@shared/types';
import type { TestFormState } from '../types';
import { dangerButtonClass, fieldClass, mutedButtonClass, panelClass, primaryButtonClass } from '../uiClasses';

interface TestCaseEditorPanelProps {
  testCasePanelTitle: string;
  testCasePanelDescription: string;
  hasAtLeastOneTestCase: boolean;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  isGeneratingSteps: boolean;
  hasSelectedTest: boolean;
  isSelectedTestDeleteBlocked: boolean;
  browser: BrowserName;
  setBrowser: (browser: BrowserName) => void;
  canStartRun: boolean;
  onBeginCreateTest: () => void;
  onGenerateSteps: () => void;
  onDeleteSelectedTest: () => void;
  onStartRun: () => void;
}

export function TestCaseEditorPanel({
  testCasePanelTitle,
  testCasePanelDescription,
  hasAtLeastOneTestCase,
  testForm,
  setTestForm,
  testTitleError,
  isGeneratingSteps,
  hasSelectedTest,
  isSelectedTestDeleteBlocked,
  browser,
  setBrowser,
  canStartRun,
  onBeginCreateTest,
  onGenerateSteps,
  onDeleteSelectedTest,
  onStartRun,
}: TestCaseEditorPanelProps): JSX.Element {
  return (
    <section className={`${panelClass} space-y-3`}>
      <div>
        <h2 className="text-[15px] font-semibold text-[#e8eff9]">{testCasePanelTitle}</h2>
        <p className="text-[11px] text-[#8e9fb8]">{testCasePanelDescription}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Test Case Title
          <input
            className={fieldClass}
            value={testForm.title}
            onChange={(event) => setTestForm((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="Checkout applies promo and captures payment"
          />
          {testTitleError ? <span className="text-[11px] text-danger">{testTitleError}</span> : null}
        </label>

        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Browser
          <select
            className={fieldClass}
            value={browser}
            onChange={(event) => setBrowser(event.target.value as BrowserName)}
          >
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
        Test Steps
        <textarea
          className={`${fieldClass} min-h-[126px] resize-y text-xs leading-relaxed`}
          rows={6}
          value={testForm.stepsText}
          onChange={(event) => setTestForm((previous) => ({ ...previous, stepsText: event.target.value }))}
          placeholder={'1. Open checkout with one item.\n2. Apply SAVE20 coupon.\n3. Complete payment with saved card.'}
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={mutedButtonClass} onClick={onBeginCreateTest}>
          Reset
        </button>
        <button
          type="button"
          className={mutedButtonClass}
          onClick={onGenerateSteps}
          disabled={isGeneratingSteps}
          aria-busy={isGeneratingSteps}
        >
          {isGeneratingSteps ? 'Generating...' : 'Generate steps (AI)'}
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          onClick={onDeleteSelectedTest}
          disabled={!hasSelectedTest || isSelectedTestDeleteBlocked}
        >
          Delete Test Case
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={onStartRun}
          disabled={!canStartRun || !hasAtLeastOneTestCase}
        >
          Run in Browser
        </button>
      </div>
    </section>
  );
}

