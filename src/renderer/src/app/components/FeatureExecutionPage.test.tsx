import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureExecutionSummary } from '@shared/types';
import { FeatureExecutionPage } from './FeatureExecutionPage';

const baseSummary: FeatureExecutionSummary = {
  featureId: 'feature-1',
  totalApproved: 4,
  passedCount: 1,
  failedCount: 1,
  runningCount: 1,
  coveredCount: 2,
  coveragePercent: 50,
  testCases: [
    {
      id: 'test-1',
      featureId: 'feature-1',
      title: 'Valid login',
      testType: 'positive',
      priority: 'high',
      hasSteps: true,
      latestRunStatus: 'passed',
      executionStatus: 'passed',
    },
    {
      id: 'test-2',
      featureId: 'feature-1',
      title: 'Invalid login',
      testType: 'negative',
      priority: 'medium',
      hasSteps: true,
      latestRunStatus: 'failed',
      executionStatus: 'failed',
    },
    {
      id: 'test-3',
      featureId: 'feature-1',
      title: 'Session timeout',
      testType: 'edge',
      priority: 'low',
      hasSteps: true,
      latestRunStatus: 'running',
      executionStatus: 'running',
    },
    {
      id: 'test-4',
      featureId: 'feature-1',
      title: 'No steps yet',
      testType: 'positive',
      priority: 'medium',
      hasSteps: false,
      latestRunStatus: null,
      executionStatus: 'not_run',
    },
  ],
};

describe('FeatureExecutionPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders overview cards and test rows', () => {
    render(
      <FeatureExecutionPage
        hasSelectedProject
        selectedProjectName="ShopFlow"
        featureTitle="Authentication hardening"
        summary={baseSummary}
        activeFilter="all"
        onChangeFilter={vi.fn()}
        onSwitchPhase={vi.fn()}
        canOpenExecution
        onEditTestCase={vi.fn()}
        onRunTestCase={vi.fn()}
        runBlocked={false}
      />,
    );

    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('Valid login')).toBeTruthy();
    expect(screen.getByText('No steps yet')).toBeTruthy();
  });

  it('calls row actions and hides run when no steps exist', () => {
    const onEditTestCase = vi.fn();
    const onRunTestCase = vi.fn();

    render(
      <FeatureExecutionPage
        hasSelectedProject
        selectedProjectName="ShopFlow"
        featureTitle="Authentication hardening"
        summary={baseSummary}
        activeFilter="all"
        onChangeFilter={vi.fn()}
        onSwitchPhase={vi.fn()}
        canOpenExecution
        onEditTestCase={onEditTestCase}
        onRunTestCase={onRunTestCase}
        runBlocked={false}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(onEditTestCase).toHaveBeenCalledWith('test-1');

    fireEvent.click(screen.getAllByRole('button', { name: 'Run' })[0]);
    expect(onRunTestCase).toHaveBeenCalledWith('test-1');

    expect(screen.getAllByRole('button', { name: 'Run' })).toHaveLength(3);
  });

  it('applies filters', () => {
    const onChangeFilter = vi.fn();
    const { rerender } = render(
      <FeatureExecutionPage
        hasSelectedProject
        selectedProjectName="ShopFlow"
        featureTitle="Authentication hardening"
        summary={baseSummary}
        activeFilter="all"
        onChangeFilter={onChangeFilter}
        onSwitchPhase={vi.fn()}
        canOpenExecution
        onEditTestCase={vi.fn()}
        onRunTestCase={vi.fn()}
        runBlocked={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Passed' }));
    expect(onChangeFilter).toHaveBeenCalledWith('passed');

    rerender(
      <FeatureExecutionPage
        hasSelectedProject
        selectedProjectName="ShopFlow"
        featureTitle="Authentication hardening"
        summary={baseSummary}
        activeFilter="failed"
        onChangeFilter={onChangeFilter}
        onSwitchPhase={vi.fn()}
        canOpenExecution
        onEditTestCase={vi.fn()}
        onRunTestCase={vi.fn()}
        runBlocked={false}
      />,
    );

    expect(screen.getByText('Invalid login')).toBeTruthy();
    expect(screen.queryByText('Valid login')).toBeNull();
  });
});
