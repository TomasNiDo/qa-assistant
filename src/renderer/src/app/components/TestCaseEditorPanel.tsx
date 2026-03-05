import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { BrowserName, StepParseWarning } from '@shared/types';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import { highlightStepsInput } from '../stepsHighlight';
import type { TestFormState } from '../types';
import {
  dangerButtonClass,
  mutedButtonClass,
  primaryButtonClass,
  subtleButtonClass,
} from '../uiClasses';

interface TestCaseEditorPanelProps {
  testCasePanelTitle: string;
  testCasePanelDescription: string;
  hasAtLeastOneTestCase: boolean;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  customCodeError: string | null;
  testStepsErrors: Array<string | null>;
  stepParseWarnings: StepParseWarning[][];
  ambiguousStepWarningCount: number;
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

function highlightPlaywrightCode(code: string): string {
  const language = Prism.languages.typescript ?? Prism.languages.javascript;
  return Prism.highlight(code, language, 'typescript');
}

function bindEditorScrollSync(
  hostElement: HTMLElement | null,
  textareaSelector: string,
  preSelector: string,
): (() => void) | undefined {
  if (!hostElement) {
    return undefined;
  }

  const textarea = hostElement.querySelector<HTMLTextAreaElement>(textareaSelector);
  const pre = hostElement.querySelector<HTMLElement>(preSelector);
  if (!textarea || !pre) {
    return undefined;
  }

  const syncScroll = (): void => {
    pre.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  };

  syncScroll();
  textarea.addEventListener('scroll', syncScroll, { passive: true });
  return () => {
    textarea.removeEventListener('scroll', syncScroll);
    pre.style.transform = '';
  };
}

export function TestCaseEditorPanel({
  testCasePanelTitle,
  testCasePanelDescription,
  hasAtLeastOneTestCase,
  testForm,
  setTestForm,
  testTitleError,
  customCodeError,
  testStepsErrors,
  stepParseWarnings,
  ambiguousStepWarningCount,
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
  const isStepsView = testForm.activeView === 'steps';
  const stepsEditorHostRef = useRef<HTMLDivElement | null>(null);
  const codeEditorHostRef = useRef<HTMLDivElement | null>(null);
  void setBrowser;
  const stepLineCount = Math.max(1, testForm.stepsText.split('\n').length);
  const parseIssueCount =
    testStepsErrors.filter(Boolean).length +
    stepParseWarnings.reduce((total, warnings) => total + warnings.length, 0);

  useEffect(
    () =>
      bindEditorScrollSync(
        stepsEditorHostRef.current,
        '.qa-steps-editor__textarea',
        '.qa-steps-editor__pre',
      ),
    [isStepsView, testForm.stepsText],
  );

  useEffect(
    () =>
      bindEditorScrollSync(
        codeEditorHostRef.current,
        '.qa-code-editor__textarea',
        '.qa-code-editor__pre',
      ),
    [isStepsView, effectiveCode],
  );

  const viewToggle = (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-1">
      <button
        type="button"
        className={`rounded-sm px-3 py-1 text-[10px] font-semibold transition-colors ${
          isStepsView ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground'
        }`}
        onClick={() => setEditorView('steps')}
        aria-pressed={isStepsView}
      >
        Steps
      </button>
      <button
        type="button"
        className={`rounded-sm px-3 py-1 text-[10px] font-semibold transition-colors ${
          !isStepsView ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground'
        }`}
        onClick={() => setEditorView('code')}
        aria-pressed={!isStepsView}
      >
        Playwright Code
      </button>
    </div>
  );

  return (
    <section className="flex min-h-0 flex-col rounded-[14px] border border-[#242424] bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {viewToggle}
          <span className="inline-flex rounded-sm border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
            {isStepsView ? 'Natural language' : 'TypeScript'}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-purple/45 bg-purple/12 px-3 py-1.5 text-[11px] font-semibold text-purple transition-colors hover:bg-purple/18 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onGenerateSteps}
          disabled={isGeneratingSteps}
          aria-busy={isGeneratingSteps}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M12 3l1.7 4.7L18.5 9l-4.8 1.3L12 15l-1.7-4.7L5.5 9l4.8-1.3L12 3z"
              fill="currentColor"
            />
          </svg>
          {isGeneratingSteps ? 'Generating...' : 'Generate with AI'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{testCasePanelTitle}</span>
        <div className="flex items-center gap-2">
          {ambiguousStepWarningCount > 0 ? (
            <span className="inline-flex rounded-full border border-warning/45 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              Ambiguous Steps: {ambiguousStepWarningCount}
            </span>
          ) : null}
          <span>{testCasePanelDescription}</span>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{isCodeModified ? 'Modified' : 'Auto-synced'}</span>
          <span>{isStepsView ? 'Steps mode' : 'Playwright mode'}</span>
        </div>

        {isStepsView ? (
          <>
            <div ref={stepsEditorHostRef} className="min-h-0 flex-1">
              <Editor
                value={testForm.stepsText}
                onValueChange={(nextValue) =>
                  setTestForm((previous) => ({ ...previous, stepsText: nextValue }))
                }
                highlight={highlightStepsInput}
                padding={12}
                className="qa-steps-editor h-[460px] rounded-md border border-[#2A2B2E] bg-[#111214]"
                textareaClassName="qa-steps-editor__textarea"
                preClassName="qa-steps-editor__pre"
                placeholder={
                  '1. Open checkout with one item.\n2. Apply SAVE20 coupon.\n3. Complete payment with saved card.'
                }
                aria-label="Test Steps"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              />
            </div>
            {testForm.isCustomized ? (
              <p className="rounded-md border border-warning/35 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
                This test has custom code. Step edits will not auto-sync.
              </p>
            ) : null}
            {parseIssueCount > 0 ? (
              <div className="space-y-1.5 rounded-md border border-border bg-background px-2.5 py-2">
                {testStepsErrors.map((error, index) => {
                  const warnings = stepParseWarnings[index] ?? [];
                  if (!error && warnings.length === 0) {
                    return null;
                  }

                  return (
                    <div key={`step-issue-${index}`} className="space-y-1 text-[11px]">
                      {error ? <p className="text-danger">Line {index + 1}: {error}</p> : null}
                      {warnings.map((warning, warningIndex) => (
                        <p
                          key={`step-warning-${index}-${warningIndex}`}
                          className="text-warning"
                        >
                          Line {index + 1}: {warning.message} Suggested:{' '}
                          <code>{warning.suggestedStep}</code>
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div ref={codeEditorHostRef} className="min-h-0 flex-1">
                <Editor
                  value={effectiveCode}
                  onValueChange={onCodeChange}
                  highlight={highlightPlaywrightCode}
                  padding={12}
                  className="qa-code-editor language-typescript h-[460px] rounded-md border border-[#2A2B2E] bg-[#111214]"
                  textareaClassName="qa-code-editor__textarea"
                  preClassName="qa-code-editor__pre language-typescript"
                  placeholder="Generated Playwright code will appear here."
                  readOnly={!testForm.isCodeEditingEnabled}
                  aria-label="Playwright Code"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <p className="mr-auto text-[11px] text-muted-foreground">
                  {testForm.isCodeEditingEnabled
                    ? 'Code edits are enabled. The next run uses this custom code once auto-saved.'
                    : 'Code is read-only while Guided mode is enabled.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
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
                      className={subtleButtonClass}
                      onClick={onRestoreGeneratedCode}
                      disabled={!testForm.isCustomized}
                    >
                    Restore Auto-Generated
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {testTitleError ? <p className="text-[11px] text-danger">{testTitleError}</p> : null}
      {customCodeError ? <p className="text-[11px] text-danger">{customCodeError}</p> : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground">
          {stepLineCount} lines · {parseIssueCount} issues · {browser}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={subtleButtonClass} onClick={onBeginCreateTest}>
            Reset
          </button>
          <button
            type="button"
            className={mutedButtonClass}
            onClick={isStepsView ? onGenerateSteps : onEnableCodeEditing}
            disabled={isStepsView ? isGeneratingSteps : testForm.isCodeEditingEnabled}
            aria-busy={isStepsView ? isGeneratingSteps : undefined}
          >
            {isStepsView
              ? isGeneratingSteps
                ? 'Generating...'
                : 'Validate Steps'
              : testForm.isCodeEditingEnabled
                ? 'Editing Enabled'
                : 'Enable Editing'}
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onDeleteSelectedTest}
            disabled={!hasSelectedTest || isSelectedTestDeleteBlocked}
          >
            Delete
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onStartRun}
            disabled={!canStartRun || !hasAtLeastOneTestCase}
          >
            Run
          </button>
        </div>
      </div>
    </section>
  );
}
