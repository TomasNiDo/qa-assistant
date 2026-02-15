import type { Dispatch, SetStateAction } from 'react';
import type { StepParseResult } from '@shared/types';
import type { TestFormState } from '../types';
import {
  dangerButtonClass,
  fieldClass,
  mutedButtonClass,
  panelClass,
  primaryButtonClass,
} from '../uiClasses';

interface TestCaseEditorPanelProps {
  testCasePanelTitle: string;
  testCasePanelDescription: string;
  hasAtLeastOneTestCase: boolean;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  parsedSteps: string[];
  stepParsePreview: StepParseResult[];
  testStepsErrors: Array<string | null>;
  isValidatingSteps: boolean;
  isGeneratingSteps: boolean;
  isTestEditing: boolean;
  canSaveTestCase: boolean;
  hasSelectedTest: boolean;
  isSelectedTestDeleteBlocked: boolean;
  onBeginCreateTest: () => void;
  onGenerateSteps: () => void;
  onSaveTestCase: () => void;
  onDeleteSelectedTest: () => void;
}

export function TestCaseEditorPanel({
  testCasePanelTitle,
  testCasePanelDescription,
  hasAtLeastOneTestCase,
  testForm,
  setTestForm,
  testTitleError,
  parsedSteps,
  stepParsePreview,
  testStepsErrors,
  isValidatingSteps,
  isGeneratingSteps,
  isTestEditing,
  canSaveTestCase,
  hasSelectedTest,
  isSelectedTestDeleteBlocked,
  onBeginCreateTest,
  onGenerateSteps,
  onSaveTestCase,
  onDeleteSelectedTest,
}: TestCaseEditorPanelProps): JSX.Element {
  return (
    <section className={panelClass}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">{testCasePanelTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{testCasePanelDescription}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            hasAtLeastOneTestCase
              ? 'border-success/60 bg-success/12 text-success'
              : 'border-primary/60 bg-primary/12 text-primary'
          }`}
        >
          {hasAtLeastOneTestCase ? 'Ready' : 'Pending'}
        </span>
      </div>

      <div className="grid gap-3">
        <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Test title
          <input
            className={fieldClass}
            value={testForm.title}
            onChange={(event) => setTestForm((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="Checkout succeeds with valid card"
          />
          {testTitleError ? <span className="text-xs text-danger">{testTitleError}</span> : null}
        </label>

        <label className="block space-y-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Step script
          <textarea
            className={`${fieldClass} min-h-[220px] resize-y font-mono text-xs`}
            rows={10}
            value={testForm.stepsText}
            onChange={(event) => setTestForm((previous) => ({ ...previous, stepsText: event.target.value }))}
            placeholder={'Click "Login"\nEnter "qa.user@example.com" in "Email" field'}
          />
        </label>

        <div className="space-y-1">
          {parsedSteps.length === 0 ? <p className="text-xs text-danger">At least one step is required.</p> : null}
          {parsedSteps.map((_, index) => {
            const parsed = stepParsePreview[index];
            const parseHint =
              parsed && parsed.ok
                ? `Step ${index + 1}: Parsed as ${parsed.action.type} (${parsed.source})`
                : `Step ${index + 1}: ${testStepsErrors[index] ?? 'Validation unavailable.'}`;

            return (
              <p
                key={`step-parse-${index}`}
                className={`text-xs ${parsed && parsed.ok ? 'text-muted-foreground' : 'text-danger'}`}
              >
                {parseHint}
              </p>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Supported patterns: Enter "value" in "field" field, Click "text" (or Click "text" after 1s), Go to
            "/path", Expect assertion, or Expect assertion within 30s.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={mutedButtonClass} onClick={onBeginCreateTest}>
            New test case
          </button>
          <button
            type="button"
            className={mutedButtonClass}
            onClick={onGenerateSteps}
            disabled={isGeneratingSteps}
            aria-busy={isGeneratingSteps}
          >
            {isGeneratingSteps ? (
              <>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>Generating steps...</span>
              </>
            ) : (
              'Generate steps (AI)'
            )}
          </button>
          <button type="button" className={primaryButtonClass} onClick={onSaveTestCase} disabled={!canSaveTestCase}>
            {isTestEditing ? 'Save test case' : 'Create test case'}
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onDeleteSelectedTest}
            disabled={!hasSelectedTest || isSelectedTestDeleteBlocked}
          >
            Delete test case
          </button>
        </div>

        {isValidatingSteps ? <p className="text-xs text-muted-foreground">Validating steps...</p> : null}
      </div>
    </section>
  );
}
