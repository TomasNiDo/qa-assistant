import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestCase } from '@shared/types';
import type { FeatureFormState } from '../types';
import { FeaturePlanningPage } from './FeaturePlanningPage';

function FeaturePlanningPageHarness(props: {
  draftedTests?: TestCase[];
  canManageDraftedTests?: boolean;
  onAddTestCase?: () => void;
  onEditDraftedTestCase?: (testCase: TestCase) => void;
  onDeleteDraftedTestCase?: (testCaseId: string) => void;
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
      draftedTests={props.draftedTests ?? []}
      canManageDraftedTests={props.canManageDraftedTests ?? true}
      isTestDeleteBlocked={() => false}
      onAddTestCase={props.onAddTestCase ?? vi.fn()}
      onEditDraftedTestCase={props.onEditDraftedTestCase ?? vi.fn()}
      onDeleteDraftedTestCase={props.onDeleteDraftedTestCase ?? vi.fn()}
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

  it('renders drafted test case rows and action callbacks', () => {
    const onEditDraftedTestCase = vi.fn();
    const onDeleteDraftedTestCase = vi.fn();

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
            isAiGenerated: false,
            generatedCode: '',
            customCode: null,
            isCustomized: false,
            createdAt: '2026-02-20T00:00:00.000Z',
            updatedAt: '2026-02-20T00:00:00.000Z',
          },
        ]}
        onEditDraftedTestCase={onEditDraftedTestCase}
        onDeleteDraftedTestCase={onDeleteDraftedTestCase}
      />, 
    );

    expect(screen.getByText('Checkout works')).toBeTruthy();
    expect(screen.getByText('Positive')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEditDraftedTestCase).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteDraftedTestCase).toHaveBeenCalledWith('test-1');
  });

  it('disables add test case when feature is not yet saved', () => {
    render(<FeaturePlanningPageHarness canManageDraftedTests={false} />);

    expect(
      (screen.getByRole('button', { name: 'Add Test Case' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText('Save the feature title and acceptance criteria first to add drafted test cases.'),
    ).toBeTruthy();
  });
});
