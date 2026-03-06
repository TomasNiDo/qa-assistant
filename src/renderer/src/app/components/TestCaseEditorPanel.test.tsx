import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestFormState } from '../types';
import { TestCaseEditorPanel } from './TestCaseEditorPanel';

function createTestForm(overrides: Partial<TestFormState> = {}): TestFormState {
  return {
    id: 'test-1',
    title: 'Checkout flow',
    testType: 'positive',
    priority: 'medium',
    isAiGenerated: false,
    stepsText: 'Click "Sign in"',
    generatedCode: 'await page.getByRole("button", { name: "Sign in" }).click();',
    customCode: '',
    isCustomized: false,
    activeView: 'steps',
    ...overrides,
  };
}

function TestCaseEditorPanelHarness(props: {
  initialForm?: TestFormState;
  onGenerateSteps?: () => void;
  onCodeChange?: (nextCode: string) => void;
  onRestoreGeneratedCode?: () => void;
  onValidateCode?: () => void;
}): JSX.Element {
  const [testForm, setTestForm] = useState<TestFormState>(props.initialForm ?? createTestForm());

  return (
    <TestCaseEditorPanel
      testForm={testForm}
      setTestForm={setTestForm}
      testTitleError={null}
      customCodeError={null}
      testStepsErrors={[null]}
      stepParseWarnings={[[]]}
      ambiguousStepWarningCount={0}
      isGeneratingSteps={false}
      effectiveCode={testForm.isCustomized ? testForm.customCode : testForm.generatedCode}
      isCodeModified={testForm.isCustomized}
      setEditorView={(view) => setTestForm((previous) => ({ ...previous, activeView: view }))}
      onCodeChange={props.onCodeChange ?? vi.fn()}
      onRestoreGeneratedCode={props.onRestoreGeneratedCode ?? vi.fn()}
      onGenerateSteps={props.onGenerateSteps ?? vi.fn()}
      onValidateCode={props.onValidateCode ?? vi.fn()}
    />
  );
}

describe('TestCaseEditorPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders editable steps editor and updates step text with line numbers', () => {
    render(<TestCaseEditorPanelHarness />);

    const stepsEditor = document.querySelector(
      '.qa-steps-editor__textarea',
    ) as HTMLTextAreaElement | null;
    expect(stepsEditor).not.toBeNull();
    if (!stepsEditor) {
      return;
    }

    expect(stepsEditor.value).toBe('Click "Sign in"');
    const lineNumbersBefore = screen.getByTestId('qa-steps-line-numbers').querySelectorAll('span');
    expect(lineNumbersBefore).toHaveLength(1);

    fireEvent.input(stepsEditor, {
      target: { value: 'Enter "john@example.com" in "Email" field\nClick "Submit"' },
    });

    const updatedEditor = document.querySelector(
      '.qa-steps-editor__textarea',
    ) as HTMLTextAreaElement | null;
    expect(updatedEditor?.value).toBe('Enter "john@example.com" in "Email" field\nClick "Submit"');

    const lineNumbersAfter = screen.getByTestId('qa-steps-line-numbers').querySelectorAll('span');
    expect(lineNumbersAfter).toHaveLength(2);
  });

  it('removes Reset/Delete/Enable Editing actions from the panel', () => {
    render(<TestCaseEditorPanelHarness />);

    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enable Editing' })).toBeNull();
  });

  it('keeps code editor editable by default and preserves syntax highlight layer', () => {
    const onCodeChange = vi.fn();
    render(<TestCaseEditorPanelHarness onCodeChange={onCodeChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Playwright code' }));

    const codeEditor = document.querySelector('.qa-code-editor__textarea') as HTMLTextAreaElement | null;
    expect(codeEditor).not.toBeNull();
    if (!codeEditor) {
      return;
    }

    expect(codeEditor.readOnly).toBe(false);
    fireEvent.input(codeEditor, { target: { value: 'await page.goto("/login")' } });
    expect(onCodeChange).toHaveBeenCalledTimes(1);

    const highlightedLayer = document.querySelector('.qa-code-editor__pre .token');
    expect(highlightedLayer).not.toBeNull();

    const codeLineNumbers = screen.getByTestId('qa-code-line-numbers').querySelectorAll('span');
    expect(codeLineNumbers.length).toBeGreaterThan(0);
  });

  it('shows copied feedback after clicking the steps copy button', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<TestCaseEditorPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('shows copied feedback after clicking the Playwright copy button', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<TestCaseEditorPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Playwright code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('shows Restore Auto-Generated only in code view when code is customized', () => {
    const onRestoreGeneratedCode = vi.fn();
    render(
      <TestCaseEditorPanelHarness
        onRestoreGeneratedCode={onRestoreGeneratedCode}
        initialForm={
          createTestForm({
            activeView: 'steps',
            isCustomized: true,
            customCode: 'await page.goto("/custom");',
          })
        }
      />,
    );

    expect(screen.queryByRole('button', { name: 'Restore Auto-Generated' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Playwright code' }));

    const restoreButton = screen.getByRole('button', { name: 'Restore Auto-Generated' });
    expect(restoreButton).toBeTruthy();

    fireEvent.click(restoreButton);
    expect(onRestoreGeneratedCode).toHaveBeenCalledTimes(1);
  });

  it('renders ambiguous warning indicator beside the line number with hover tooltip', () => {
    const [testForm, setTestForm] = [
      createTestForm({
        priority: 'high',
        stepsText: 'Enter "product1" in "Search" field',
      }),
      vi.fn(),
    ];

    render(
      <TestCaseEditorPanel
        testForm={testForm}
        setTestForm={setTestForm}
        testTitleError={null}
        customCodeError={null}
        testStepsErrors={[null]}
        stepParseWarnings={[
          [
            {
              code: 'ambiguous_target',
              message: 'Target lookup is ambiguous.',
              suggestedStep: 'Enter "product1" in "Search" field using placeholder',
            },
          ],
        ]}
        ambiguousStepWarningCount={1}
        isGeneratingSteps={false}
        effectiveCode=""
        isCodeModified={false}
        setEditorView={vi.fn()}
        onCodeChange={vi.fn()}
        onRestoreGeneratedCode={vi.fn()}
        onGenerateSteps={vi.fn()}
        onValidateCode={vi.fn()}
      />,
    );

    expect(screen.getByText('Ambiguous Steps: 1')).toBeTruthy();
    expect(
      screen.queryByText(/Enter "product1" in "Search" field using placeholder/),
    ).toBeNull();

    const warningDot = document.querySelector('.qa-editor-line-warning-dot') as HTMLElement | null;
    expect(warningDot).not.toBeNull();
    if (!warningDot) {
      return;
    }

    fireEvent.mouseEnter(warningDot);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Target lookup is ambiguous.');
    expect(tooltip.textContent).toContain(
      'Enter "product1" in "Search" field using placeholder',
    );
  });

  it('renders red error indicator beside the line number with error tooltip', () => {
    const [testForm, setTestForm] = [
      createTestForm({
        stepsText: 'Click "Delete"\nawdwad',
      }),
      vi.fn(),
    ];

    render(
      <TestCaseEditorPanel
        testForm={testForm}
        setTestForm={setTestForm}
        testTitleError={null}
        customCodeError={null}
        testStepsErrors={[null, 'Unable to parse step. Use Enter/Click/Go to/Expect.']}
        stepParseWarnings={[[], []]}
        ambiguousStepWarningCount={0}
        isGeneratingSteps={false}
        effectiveCode=""
        isCodeModified={false}
        setEditorView={vi.fn()}
        onCodeChange={vi.fn()}
        onRestoreGeneratedCode={vi.fn()}
        onGenerateSteps={vi.fn()}
        onValidateCode={vi.fn()}
      />,
    );

    const errorDot = document.querySelector('.qa-editor-line-error-dot') as HTMLElement | null;
    expect(errorDot).not.toBeNull();
    if (!errorDot) {
      return;
    }

    fireEvent.mouseEnter(errorDot);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Unable to parse step. Use Enter/Click/Go to/Expect.');
  });
});
