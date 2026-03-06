import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { StepParseWarning } from '@shared/types';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import { highlightStepsInput } from '../stepsHighlight';
import { copyTextToClipboard } from '../utils';
import type { TestFormState } from '../types';

interface TestCaseEditorPanelProps {
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  customCodeError: string | null;
  testStepsErrors: Array<string | null>;
  stepParseWarnings: StepParseWarning[][];
  ambiguousStepWarningCount: number;
  isGeneratingSteps: boolean;
  effectiveCode: string;
  isCodeModified: boolean;
  setEditorView: (view: TestFormState['activeView']) => void;
  onCodeChange: (nextCode: string) => void;
  onRestoreGeneratedCode: () => void;
  onGenerateSteps: () => void;
  onValidateCode: () => void;
}

function highlightPlaywrightCode(code: string): string {
  const language = Prism.languages.typescript ?? Prism.languages.javascript;
  return Prism.highlight(code, language, 'typescript');
}

function bindEditorScrollSync(
  hostElement: HTMLElement | null,
  textareaSelector: string,
  preSelector: string,
  lineNumberSelector: string,
): (() => void) | undefined {
  if (!hostElement) {
    return undefined;
  }

  const textarea = hostElement.querySelector<HTMLTextAreaElement>(textareaSelector);
  const pre = hostElement.querySelector<HTMLElement>(preSelector);
  const lineNumbers = hostElement.querySelector<HTMLElement>(lineNumberSelector);
  if (!textarea || !pre || !lineNumbers) {
    return undefined;
  }

  const syncScroll = (): void => {
    pre.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    lineNumbers.style.transform = `translateY(${-textarea.scrollTop}px)`;
  };

  syncScroll();
  textarea.addEventListener('scroll', syncScroll, { passive: true });
  return () => {
    textarea.removeEventListener('scroll', syncScroll);
    pre.style.transform = '';
    lineNumbers.style.transform = '';
  };
}

function formatCodeFileName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'untitled'}.spec.ts`;
}

export function TestCaseEditorPanel({
  testForm,
  setTestForm,
  testTitleError,
  customCodeError,
  testStepsErrors,
  stepParseWarnings,
  ambiguousStepWarningCount,
  isGeneratingSteps,
  effectiveCode,
  isCodeModified,
  setEditorView,
  onCodeChange,
  onRestoreGeneratedCode,
  onGenerateSteps,
  onValidateCode,
}: TestCaseEditorPanelProps): JSX.Element {
  const isStepsView = testForm.activeView === 'steps';
  const stepsEditorHostRef = useRef<HTMLDivElement | null>(null);
  const codeEditorHostRef = useRef<HTMLDivElement | null>(null);
  const resetStepsCopiedTimeoutRef = useRef<number | null>(null);
  const resetCodeCopiedTimeoutRef = useRef<number | null>(null);
  const [stepsCopyStatus, setStepsCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [codeCopyStatus, setCodeCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const stepLineCount = Math.max(1, testForm.stepsText.split('\n').length);
  const codeLineCount = Math.max(1, effectiveCode.split('\n').length);
  const parseIssueCount =
    testStepsErrors.filter(Boolean).length +
    stepParseWarnings.reduce((total, warnings) => total + warnings.length, 0);
  const codeFileName = formatCodeFileName(testForm.title);

  useEffect(
    () =>
      bindEditorScrollSync(
        stepsEditorHostRef.current,
        '.qa-steps-editor__textarea',
        '.qa-steps-editor__pre',
        '.qa-steps-editor-line-number-list',
      ),
    [isStepsView, testForm.stepsText],
  );

  useEffect(
    () =>
      bindEditorScrollSync(
        codeEditorHostRef.current,
        '.qa-code-editor__textarea',
        '.qa-code-editor__pre',
        '.qa-code-editor-line-number-list',
      ),
    [isStepsView, effectiveCode],
  );

  useEffect(
    () => () => {
      if (resetStepsCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetStepsCopiedTimeoutRef.current);
      }
      if (resetCodeCopiedTimeoutRef.current !== null) {
        window.clearTimeout(resetCodeCopiedTimeoutRef.current);
      }
    },
    [],
  );

  const viewToggle = (
    <div className="inline-flex items-center rounded-[6px] border border-[#2A2A2A] bg-[#121212] p-[2px]">
      <button
        type="button"
        className={`rounded-[4px] px-[10px] py-[6px] text-[11px] transition-colors ${
          isStepsView
            ? 'border border-[#10B98166] bg-[#22C55E22] font-semibold text-[#22C55E]'
            : 'border border-[#2D3440] bg-[#16181C] text-[#6B7280]'
        }`}
        onClick={() => setEditorView('steps')}
        aria-pressed={isStepsView}
      >
        Steps
      </button>
      <button
        type="button"
        className={`rounded-[4px] px-[10px] py-[6px] text-[11px] transition-colors ${
          !isStepsView
            ? 'border border-[#10B98166] bg-[#22C55E22] font-semibold text-[#86efac]'
            : 'border border-[#1F1F1F] bg-[#111111] text-[#6B7280]'
        }`}
        onClick={() => setEditorView('code')}
        aria-pressed={!isStepsView}
      >
        Playwright code
      </button>
    </div>
  );

  return (
    <section className="flex min-h-0 flex-col rounded-[10px] border border-[#1A1A1A] bg-[#111111] p-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-[#737373]">Test Definition</span>
          {viewToggle}
        </div>

        {isStepsView ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#7C3AED44] bg-[#7C3AED18] px-3 py-1.5 text-[11px] font-medium text-[#A78BFA] transition-colors hover:bg-[#7C3AED24] disabled:cursor-not-allowed disabled:opacity-60"
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
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-[#525252]">
        <span>{isStepsView ? 'Natural language steps' : 'TypeScript'}</span>
        {ambiguousStepWarningCount > 0 ? (
          <span className="inline-flex rounded-full border border-warning/45 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            Ambiguous Steps: {ambiguousStepWarningCount}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        {isStepsView ? (
          <>
            <div className="text-[11px] text-[#3F3F46]">steps.txt</div>
            <div ref={stepsEditorHostRef} className="qa-editor-textarea-frame h-[460px]">
              <div className="qa-editor-line-number-rail">
                <div className="qa-editor-line-number-list qa-steps-editor-line-number-list" data-testid="qa-steps-line-numbers">
                  {Array.from({ length: stepLineCount }, (_unused, index) => (
                    <span key={`step-line-${index + 1}`}>{index + 1}</span>
                  ))}
                </div>
              </div>

              <Editor
                value={testForm.stepsText}
                onValueChange={(nextValue) =>
                  setTestForm((previous) => ({ ...previous, stepsText: nextValue }))
                }
                highlight={highlightStepsInput}
                padding={14}
                className="qa-steps-editor qa-editor-input"
                textareaClassName="qa-steps-editor__textarea"
                preClassName="qa-steps-editor__pre"
                placeholder={
                  'Navigate to "/login"\nEnter "qa.user@acme.com" in "Email" field\nClick "Sign in"'
                }
                aria-label="Test Steps"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div className="flex items-center justify-between px-0 py-[6px]">
              <span className="text-[11px] text-[#525252]">{stepLineCount} steps</span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#1F1F1F] px-[10px] py-[5px] text-[11px] text-[#737373] transition-colors hover:border-[#2B2B2B] hover:text-[#A3A3A3] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    setStepsCopyStatus('copied');
                    const copied = await copyTextToClipboard(testForm.stepsText);
                    if (!copied) {
                      setStepsCopyStatus('failed');
                    }

                    if (resetStepsCopiedTimeoutRef.current !== null) {
                      window.clearTimeout(resetStepsCopiedTimeoutRef.current);
                    }
                    resetStepsCopiedTimeoutRef.current = window.setTimeout(() => {
                      setStepsCopyStatus('idle');
                      resetStepsCopiedTimeoutRef.current = null;
                    }, 1200);
                  })();
                }}
                disabled={!testForm.stepsText.trim()}
              >
                {stepsCopyStatus === 'copied'
                  ? 'Copied'
                  : stepsCopyStatus === 'failed'
                    ? 'Copy failed'
                    : 'Copy'}
              </button>
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
                        <p key={`step-warning-${index}-${warningIndex}`} className="text-warning">
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
            <div className="flex items-center justify-between text-[11px] text-[#525252]">
              <span>{codeFileName}</span>
              <span className="text-[#3F3F46]">Converted from natural language</span>
            </div>

            <div ref={codeEditorHostRef} className="qa-editor-textarea-frame h-[460px]">
              <div className="qa-editor-line-number-rail">
                <div className="qa-editor-line-number-list qa-code-editor-line-number-list" data-testid="qa-code-line-numbers">
                  {Array.from({ length: codeLineCount }, (_unused, index) => (
                    <span key={`code-line-${index + 1}`}>{index + 1}</span>
                  ))}
                </div>
              </div>

              <Editor
                value={effectiveCode}
                onValueChange={onCodeChange}
                highlight={highlightPlaywrightCode}
                padding={14}
                className="qa-code-editor language-typescript qa-editor-input"
                textareaClassName="qa-code-editor__textarea"
                preClassName="qa-code-editor__pre language-typescript"
                placeholder="Generated Playwright code will appear here."
                aria-label="Playwright Code"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              />
            </div>

            <div className="flex items-center justify-between px-0 py-[6px]">
              <span className="text-[11px] text-[#525252]">{codeLineCount} lines · TypeScript</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#1F1F1F] px-[10px] py-[5px] text-[11px] text-[#737373] transition-colors hover:border-[#2B2B2B] hover:text-[#A3A3A3]"
                  onClick={onValidateCode}
                >
                  Validate
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#1F1F1F] px-[10px] py-[5px] text-[11px] text-[#737373] transition-colors hover:border-[#2B2B2B] hover:text-[#A3A3A3] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      setCodeCopyStatus('copied');
                      const copied = await copyTextToClipboard(effectiveCode);
                      if (!copied) {
                        setCodeCopyStatus('failed');
                      }

                      if (resetCodeCopiedTimeoutRef.current !== null) {
                        window.clearTimeout(resetCodeCopiedTimeoutRef.current);
                      }
                      resetCodeCopiedTimeoutRef.current = window.setTimeout(() => {
                        setCodeCopyStatus('idle');
                        resetCodeCopiedTimeoutRef.current = null;
                      }, 1200);
                    })();
                  }}
                  disabled={!effectiveCode.trim()}
                >
                  {codeCopyStatus === 'copied'
                    ? 'Copied'
                    : codeCopyStatus === 'failed'
                      ? 'Copy failed'
                      : 'Copy'}
                </button>
              </div>
            </div>

            {testForm.isCustomized ? (
              <div className="flex items-center justify-between border-t border-[#1A1A1A] pt-2">
                <span className="text-[11px] text-[#525252]">
                  {isCodeModified ? 'Modified' : 'Auto-synced'}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#1F1F1F] px-[10px] py-[5px] text-[11px] text-[#737373] transition-colors hover:border-[#2B2B2B] hover:text-[#A3A3A3]"
                  onClick={onRestoreGeneratedCode}
                >
                  Restore Auto-Generated
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {testTitleError ? <p className="mt-2 text-[11px] text-danger">{testTitleError}</p> : null}
      {customCodeError ? <p className="mt-1 text-[11px] text-danger">{customCodeError}</p> : null}
    </section>
  );
}
