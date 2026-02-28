import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestFormState } from '../types';
import { TestCaseEditorPanel } from './TestCaseEditorPanel';

function TestCaseEditorPanelHarness(props: {
  onGenerateSteps?: () => void;
  onStartRun?: () => void;
}): JSX.Element {
  const [testForm, setTestForm] = useState<TestFormState>({
    id: 'test-1',
    title: 'Checkout flow',
    stepsText: 'Click "Sign in"',
    generatedCode: 'await page.getByRole("button", { name: "Sign in" }).click();',
    customCode: '',
    isCustomized: false,
    isCodeEditingEnabled: false,
    activeView: 'steps',
  });

  return (
    <TestCaseEditorPanel
      testCasePanelTitle="Scenario Setup"
      testCasePanelDescription="Define metadata first."
      hasAtLeastOneTestCase
      testForm={testForm}
      setTestForm={setTestForm}
      testTitleError={null}
      customCodeError={null}
      testStepsErrors={[null]}
      stepParseWarnings={[[]]}
      ambiguousStepWarningCount={0}
      isGeneratingSteps={false}
      hasSelectedTest
      isSelectedTestDeleteBlocked={false}
      effectiveCode={testForm.generatedCode}
      isCodeModified={false}
      browser="chromium"
      setBrowser={vi.fn()}
      canStartRun
      setEditorView={(view) => setTestForm((previous) => ({ ...previous, activeView: view }))}
      onEnableCodeEditing={vi.fn()}
      onCodeChange={vi.fn()}
      onRestoreGeneratedCode={vi.fn()}
      onBeginCreateTest={vi.fn()}
      onGenerateSteps={props.onGenerateSteps ?? vi.fn()}
      onDeleteSelectedTest={vi.fn()}
      onStartRun={props.onStartRun ?? vi.fn()}
    />
  );
}

describe('TestCaseEditorPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders editable steps editor and updates step text', () => {
    render(<TestCaseEditorPanelHarness />);

    const stepsEditor = document.querySelector('.qa-steps-editor__textarea') as HTMLTextAreaElement | null;
    expect(stepsEditor).not.toBeNull();
    if (!stepsEditor) {
      return;
    }
    expect(stepsEditor.value).toBe('Click "Sign in"');

    fireEvent.input(stepsEditor, { target: { value: 'Enter "john@example.com" in "Email" field' } });
    const updatedEditor = document.querySelector('.qa-steps-editor__textarea') as HTMLTextAreaElement | null;
    expect(updatedEditor?.value).toBe('Enter "john@example.com" in "Email" field');
  });

  it('keeps Generate and Start Run controls functional in steps view', () => {
    const onGenerateSteps = vi.fn();
    const onStartRun = vi.fn();
    render(
      <TestCaseEditorPanelHarness
        onGenerateSteps={onGenerateSteps}
        onStartRun={onStartRun}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Generate Steps (AI)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }));

    expect(onGenerateSteps).toHaveBeenCalledTimes(1);
    expect(onStartRun).toHaveBeenCalledTimes(1);
  });

  it('renders ambiguous warning indicator and inline suggested rewrite', () => {
    const [testForm, setTestForm] = [
      {
        id: 'test-1',
        title: 'Checkout flow',
        stepsText: 'Enter "product1" in "Search" field',
        generatedCode: '',
        customCode: '',
        isCustomized: false,
        isCodeEditingEnabled: false,
        activeView: 'steps' as const,
      },
      vi.fn(),
    ];

    render(
      <TestCaseEditorPanel
        testCasePanelTitle="Scenario Setup"
        testCasePanelDescription="Define metadata first."
        hasAtLeastOneTestCase
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
        hasSelectedTest
        isSelectedTestDeleteBlocked={false}
        effectiveCode=""
        isCodeModified={false}
        browser="chromium"
        setBrowser={vi.fn()}
        canStartRun
        setEditorView={vi.fn()}
        onEnableCodeEditing={vi.fn()}
        onCodeChange={vi.fn()}
        onRestoreGeneratedCode={vi.fn()}
        onBeginCreateTest={vi.fn()}
        onGenerateSteps={vi.fn()}
        onDeleteSelectedTest={vi.fn()}
        onStartRun={vi.fn()}
      />,
    );

    expect(screen.getByText('Ambiguous Steps: 1')).toBeTruthy();
    expect(screen.getByText(/Enter "product1" in "Search" field using placeholder/)).toBeTruthy();
  });
});
