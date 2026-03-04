import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURE_FORM } from '../types';
import { resolveProjectFeatureSelection } from './useFeaturesDomain';

describe('useFeaturesDomain logic helpers', () => {
  it('returns create mode with empty form when the selected project has no features', () => {
    const result = resolveProjectFeatureSelection({
      featuresForProject: [],
      selectedFeatureId: 'feature-1',
    });

    expect(result).toEqual({
      selectedFeatureId: '',
      featureFormMode: 'create',
      featureForm: DEFAULT_FEATURE_FORM,
    });
  });

  it('keeps the selected feature when it belongs to the current project', () => {
    const result = resolveProjectFeatureSelection({
      featuresForProject: [
        {
          id: 'feature-1',
          projectId: 'project-1',
          title: 'Checkout',
          acceptanceCriteria: 'Given cart has items',
          requirements: 'Use existing tax service',
          notes: 'Sync with billing',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      selectedFeatureId: 'feature-1',
    });

    expect(result).toEqual({
      selectedFeatureId: 'feature-1',
      featureFormMode: 'edit',
      featureForm: {
        id: 'feature-1',
        title: 'Checkout',
        acceptanceCriteria: 'Given cart has items',
        requirements: 'Use existing tax service',
        notes: 'Sync with billing',
      },
    });
  });

  it('falls back to the first project feature when current selection is from another project', () => {
    const result = resolveProjectFeatureSelection({
      featuresForProject: [
        {
          id: 'feature-9',
          projectId: 'project-2',
          title: 'Imported',
          acceptanceCriteria: 'Imported legacy cases',
          requirements: null,
          notes: null,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      selectedFeatureId: 'feature-1',
    });

    expect(result).toEqual({
      selectedFeatureId: 'feature-9',
      featureFormMode: 'edit',
      featureForm: {
        id: 'feature-9',
        title: 'Imported',
        acceptanceCriteria: 'Imported legacy cases',
        requirements: '',
        notes: '',
      },
    });
  });
});
