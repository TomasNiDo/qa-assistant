import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestCase } from '@shared/types';
import type { FeatureFormState } from '../types';
import { FeaturePlanningPage } from './FeaturePlanningPage';

function FeaturePlanningPageHarness(props: {
  draftedTests?: TestCase[];
  approvedTests?: TestCase[];
  selectedDraftedTestIds?: string[];
  canManageDraftedTests?: boolean;
  onAddTestCase?: () => void;
  onToggleDraftedSelection?: (testCaseId: string, checked: boolean) => void;
  onApproveDraftedTestCase?: (testCaseId: string) => void;
  onApproveSelectedDraftedTests?: () => void;
  onMoveBackApprovedTestCase?: (testCaseId: string) => void;
  onDeleteTestCase?: (testCaseId: string) => void;
  onSwitchPhase?: (phase: 'planning' | 'execution') => void;
  canOpenExecution?: boolean;
}): JSX.Element {
  const [featureForm, setFeatureForm] = useState<FeatureFormState>({
    id: 'feature-1',
    title: 'Checkout planning',
    acceptanceCriteria: 'Checkout flow succeeds for valid cards.',
    requirements: '',
    notes: '',
  });

  return (
    <FeaturePlanningPage
      hasSelectedProject
      selectedProjectName="ShopFlow"
      featureForm={featureForm}
      setFeatureForm={setFeatureForm}
      featureFormMode="edit"
      featureTitleError={null}
      featureAcceptanceCriteriaError={null}
      featureAutoSaveStatus="saved"
      featureAutoSaveMessage="Saved"
      onSwitchPhase={props.onSwitchPhase ?? vi.fn()}
      canOpenExecution={props.canOpenExecution ?? true}
      draftedTests={props.draftedTests ?? []}
      approvedTests={props.approvedTests ?? []}
      selectedDraftedTestIds={props.selectedDraftedTestIds ?? []}
      canManageDraftedTests={props.canManageDraftedTests ?? true}
      isTestDeleteBlocked={() => false}
      onAddTestCase={props.onAddTestCase ?? vi.fn()}
      onToggleDraftedSelection={props.onToggleDraftedSelection ?? vi.fn()}
      onApproveDraftedTestCase={props.onApproveDraftedTestCase ?? vi.fn()}
      onApproveSelectedDraftedTests={props.onApproveSelectedDraftedTests ?? vi.fn()}
      onMoveBackApprovedTestCase={props.onMoveBackApprovedTestCase ?? vi.fn()}
      onDeleteTestCase={props.onDeleteTestCase ?? vi.fn()}
    />
  );
}

describe('FeaturePlanningPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders feature form fields and updates title input', () => {
    render(<FeaturePlanningPageHarness />);

    const titleInput = screen.getByPlaceholderText(
      'Checkout supports promo code stacking',
    ) as HTMLInputElement;

    expect(titleInput.value).toBe('Checkout planning');

    fireEvent.input(titleInput, { target: { value: 'Checkout edge planning' } });
    expect(
      (screen.getByPlaceholderText('Checkout supports promo code stacking') as HTMLInputElement)
        .value,
    ).toBe('Checkout edge planning');
  });

  it('renders drafted and approved sections with actions', () => {
    const onApproveDraftedTestCase = vi.fn();
    const onMoveBackApprovedTestCase = vi.fn();
    const onDeleteTestCase = vi.fn();
    const onToggleDraftedSelection = vi.fn();

    render(
      <FeaturePlanningPageHarness
        draftedTests={[
          {
            id: 'test-1',
            projectId: 'project-1',
            featureId: 'feature-1',
            title: 'Checkout works',
            testType: 'positive',
            priority: 'high',
            planningStatus: 'drafted',
            isAiGenerated: false,
            generatedCode: '',
            customCode: null,
            isCustomized: false,
            createdAt: '2026-02-20T00:00:00.000Z',
            updatedAt: '2026-02-20T00:00:00.000Z',
          },
        ]}
        approvedTests={[
          {
            id: 'test-2',
            projectId: 'project-1',
            featureId: 'feature-1',
            title: 'Checkout approved',
            testType: 'edge',
            priority: 'medium',
            planningStatus: 'approved',
            isAiGenerated: false,
            generatedCode: '',
            customCode: null,
            isCustomized: false,
            createdAt: '2026-02-20T00:00:00.000Z',
            updatedAt: '2026-02-20T00:00:00.000Z',
          },
        ]}
        selectedDraftedTestIds={['test-1']}
        onApproveDraftedTestCase={onApproveDraftedTestCase}
        onMoveBackApprovedTestCase={onMoveBackApprovedTestCase}
        onDeleteTestCase={onDeleteTestCase}
        onToggleDraftedSelection={onToggleDraftedSelection}
      />, 
    );

    expect(screen.getByRole('heading', { name: 'Drafted Test Cases' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approved Test Cases' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Approve Checkout works' }));
    expect(onApproveDraftedTestCase).toHaveBeenCalledWith('test-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Move Checkout approved back to drafted' }),
    );
    expect(onMoveBackApprovedTestCase).toHaveBeenCalledWith('test-2');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(onDeleteTestCase).toHaveBeenCalledWith('test-1');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Checkout works' }));
    expect(onToggleDraftedSelection).toHaveBeenCalledWith('test-1', false);
  });

  it('disables bulk approval when no drafted selections', () => {
    render(<FeaturePlanningPageHarness selectedDraftedTestIds={[]} />);

    expect(
      (screen.getByRole('button', { name: 'Approved Test Cases' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('renders phase switch and forwards execution selection', () => {
    const onSwitchPhase = vi.fn();
    render(<FeaturePlanningPageHarness onSwitchPhase={onSwitchPhase} />);

    fireEvent.click(screen.getByRole('button', { name: 'Execution' }));
    expect(onSwitchPhase).toHaveBeenCalledWith('execution');
  });
});
