import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestFormState } from '../types';
import { TestCaseEditorPanel } from './TestCaseEditorPanel';

function TestCaseEditorPanelHarness(props: {
  onStartRun?: () => void;
}): JSX.Element {
  const [testForm, setTestForm] = useState<TestFormState>({
    id: 'test-1',
    title: 'Checkout flow',
    testType: 'positive',
    priority: 'medium',
    isAiGenerated: false,
  });

  return (
    <TestCaseEditorPanel
      testCasePanelTitle="Scenario Setup"
      testCasePanelDescription="Define metadata first."
      testForm={testForm}
      setTestForm={setTestForm}
      testTitleError={null}
      hasSelectedTest
      isSelectedTestDeleteBlocked={false}
      selectedTestHasSteps={false}
      canStartRun={false}
      onBeginCreateTest={vi.fn()}
      onDeleteSelectedTest={vi.fn()}
      onStartRun={props.onStartRun ?? vi.fn()}
    />
  );
}

describe('TestCaseEditorPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders planning metadata fields and updates test title', () => {
    render(<TestCaseEditorPanelHarness />);

    const titleInput = screen.getByPlaceholderText(
      'Checkout applies promo and captures payment',
    ) as HTMLInputElement;
    expect(titleInput.value).toBe('Checkout flow');

    fireEvent.input(titleInput, { target: { value: 'Checkout edge flow' } });
    const updatedInput = screen.getByPlaceholderText(
      'Checkout applies promo and captures payment',
    ) as HTMLInputElement;
    expect(updatedInput.value).toBe('Checkout edge flow');
  });

  it('renders planning-mode guidance', () => {
    render(<TestCaseEditorPanelHarness />);

    expect(screen.getByText('Planning mode')).toBeTruthy();
    expect(
      screen.getByText('Feature planning is active. Step authoring is deferred to a later phase.'),
    ).toBeTruthy();
  });

  it('keeps Start Run control functional when enabled', () => {
    const onStartRun = vi.fn();

    const [testForm, setTestForm] = [
      {
        id: 'test-1',
        title: 'Checkout flow',
        testType: 'positive',
        priority: 'high',
        isAiGenerated: true,
      } satisfies TestFormState,
      vi.fn(),
    ];

    render(
      <TestCaseEditorPanel
        testCasePanelTitle="Scenario Setup"
        testCasePanelDescription="Define metadata first."
        testForm={testForm}
        setTestForm={setTestForm}
        testTitleError={null}
        hasSelectedTest
        isSelectedTestDeleteBlocked={false}
        selectedTestHasSteps
        canStartRun
        onBeginCreateTest={vi.fn()}
        onDeleteSelectedTest={vi.fn()}
        onStartRun={onStartRun}
      />, 
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Run' }));
    expect(onStartRun).toHaveBeenCalledTimes(1);
  });
});
