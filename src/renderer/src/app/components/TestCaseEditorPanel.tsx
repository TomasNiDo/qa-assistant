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
  customCodeError: string | null;
  isGeneratingSteps: boolean;
  hasSelectedTest: boolean;
  isSelectedTestDeleteBlocked: boolean;
  effectiveCode: string;
  isCodeModified: boolean;
  browser: BrowserName;
  setBrowser: (browser: BrowserName) => void;
  canStartRun: boolean;
  setEditorView: (view: TestFormState['activeView']) => void;
  onEnableCodeEditing: () => void;
  onCodeChange: (nextCode: string) => void;
  onRestoreGeneratedCode: () => void;
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
  customCodeError,
  isGeneratingSteps,
  hasSelectedTest,
  isSelectedTestDeleteBlocked,
  effectiveCode,
  isCodeModified,
  browser,
  setBrowser,
  canStartRun,
  setEditorView,
  onEnableCodeEditing,
  onCodeChange,
  onRestoreGeneratedCode,
  onBeginCreateTest,
  onGenerateSteps,
  onDeleteSelectedTest,
  onStartRun,
}: TestCaseEditorPanelProps): JSX.Element {
  const viewToggle = (
    <div className="inline-flex items-center rounded-full bg-secondary/80 p-1">
      <button
        type="button"
        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
          testForm.activeView === 'steps' ? 'bg-primary text-primary-foreground' : 'text-[#9eb1ca]'
        }`}
        onClick={() => setEditorView('steps')}
      >
        Steps
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
          testForm.activeView === 'code' ? 'bg-primary text-primary-foreground' : 'text-[#9eb1ca]'
        }`}
        onClick={() => setEditorView('code')}
      >
        Code
      </button>
    </div>
  );

  return (
    <section className={`${panelClass} space-y-3`}>
      <div>
        <h2 className="text-[15px] font-semibold text-[#e8eff9]">{testCasePanelTitle}</h2>
        <p className="text-[11px] text-[#8e9fb8]">{testCasePanelDescription}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block text-xs font-semibold text-[#a9b9d1]">
          <span className="mb-3 block">Test Case Title</span>
          <input
            className={fieldClass}
            value={testForm.title}
            onChange={(event) => setTestForm((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="Checkout applies promo and captures payment"
          />
          {testTitleError ? <span className="mt-1 block text-[11px] text-danger">{testTitleError}</span> : null}
        </label>

        <label className="block text-xs font-semibold text-[#a9b9d1]">
          <span className="mb-3 block">Browser</span>
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

      {testForm.activeView === 'steps' ? (
        <div className="space-y-2">
          <p className="mb-3 text-xs font-semibold text-[#a9b9d1]">Test Steps</p>
          <div className="relative">
            <div className="absolute right-2 top-2 z-10">{viewToggle}</div>
            <textarea
              className={`${fieldClass} h-80 resize-y pr-36 text-xs leading-relaxed`}
              rows={6}
              value={testForm.stepsText}
              onChange={(event) => setTestForm((previous) => ({ ...previous, stepsText: event.target.value }))}
              placeholder={'1. Open checkout with one item.\n2. Apply SAVE20 coupon.\n3. Complete payment with saved card.'}
              aria-label="Test Steps"
            />
          </div>
          {testForm.isCustomized ? (
            <p className="rounded-md border border-warning/35 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
              This test has custom code. Step edits will not auto-sync.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#a9b9d1]">Playwright Code</p>
            {isCodeModified ? (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                Modified
              </span>
            ) : null}
          </div>
          <div className="relative">
            <div className="absolute right-2 top-2 z-10">{viewToggle}</div>
            <div className="absolute bottom-4 right-2 z-10 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={mutedButtonClass}
                onClick={onEnableCodeEditing}
                disabled={testForm.isCodeEditingEnabled}
              >
                {testForm.isCodeEditingEnabled ? 'Editing Enabled' : 'Enable Editing'}
              </button>
              <button
                type="button"
                className={mutedButtonClass}
                onClick={onRestoreGeneratedCode}
                disabled={!testForm.isCustomized}
              >
                Restore Auto-Generated
              </button>
            </div>
            <textarea
              className={`${fieldClass} h-80 resize-y pb-16 pr-36 font-mono text-[12px] leading-relaxed`}
              rows={12}
              value={effectiveCode}
              readOnly={!testForm.isCodeEditingEnabled}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="Generated Playwright code will appear here."
            />
          </div>
        </div>
      )}

      {customCodeError ? <p className="text-[11px] text-danger">{customCodeError}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {testForm.activeView === 'code' ? (
          <p className="mr-auto text-[11px] text-[#8e9fb8]">
            {testForm.isCodeEditingEnabled
              ? 'Code edits are enabled. The test will run this custom code once saved.'
              : 'Code is read-only by default. Enable editing to customize execution.'}
          </p>
        ) : null}
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
          Start Run
        </button>
      </div>
    </section>
  );
}
