import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Feature, Project } from '@shared/types';
import {
  DEFAULT_FEATURE_FORM,
  type FeatureFormState,
  type ProjectFormMode,
} from '../types';
import { toErrorMessage } from '../utils';

interface UseFeaturesDomainArgs {
  selectedProjectId: string;
  onMessage: (message: string) => void;
}

interface ProjectFeatureSelectionInput {
  featuresForProject: Feature[];
  selectedFeatureId: string;
}

interface ProjectFeatureSelectionResult {
  selectedFeatureId: string;
  featureFormMode: ProjectFormMode;
  featureForm: FeatureFormState;
}

export interface UseFeaturesDomainResult {
  featuresByProject: Record<string, Feature[]>;
  selectedFeatureId: string;
  setSelectedFeatureId: (featureId: string) => void;
  selectedProjectFeatures: Feature[];
  selectedFeature: Feature | null;
  featureForm: FeatureFormState;
  setFeatureForm: Dispatch<SetStateAction<FeatureFormState>>;
  featureFormMode: ProjectFormMode;
  featureTitleError: string | null;
  featureAcceptanceCriteriaError: string | null;
  canSaveFeature: boolean;
  refreshFeaturesTree: (
    projectRows: Project[],
    preferredProjectId: string,
    preferredFeatureId?: string,
  ) => Promise<Record<string, Feature[]>>;
  selectProject: (projectId: string) => void;
  beginCreateFeature: () => void;
  beginEditSelectedFeature: (featureId?: string) => void;
  createFeature: () => Promise<Feature | null>;
  updateSelectedFeature: () => Promise<Feature | null>;
  deleteSelectedFeature: (onFeatureDeleted: () => Promise<void>, featureId?: string) => Promise<boolean>;
}

export function resolveProjectFeatureSelection({
  featuresForProject,
  selectedFeatureId,
}: ProjectFeatureSelectionInput): ProjectFeatureSelectionResult {
  const selectedFeature =
    featuresForProject.find((feature) => feature.id === selectedFeatureId) ?? featuresForProject[0];

  if (!selectedFeature) {
    return {
      selectedFeatureId: '',
      featureFormMode: 'create',
      featureForm: DEFAULT_FEATURE_FORM,
    };
  }

  return {
    selectedFeatureId: selectedFeature.id,
    featureFormMode: 'edit',
    featureForm: {
      id: selectedFeature.id,
      title: selectedFeature.title,
      acceptanceCriteria: selectedFeature.acceptanceCriteria,
      requirements: selectedFeature.requirements ?? '',
      notes: selectedFeature.notes ?? '',
    },
  };
}

export function useFeaturesDomain({
  selectedProjectId,
  onMessage,
}: UseFeaturesDomainArgs): UseFeaturesDomainResult {
  const [featuresByProject, setFeaturesByProject] = useState<Record<string, Feature[]>>({});
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const [featureForm, setFeatureForm] = useState<FeatureFormState>(DEFAULT_FEATURE_FORM);
  const [featureFormMode, setFeatureFormMode] = useState<ProjectFormMode>('create');

  const selectedProjectFeatures = useMemo(
    () => (selectedProjectId ? featuresByProject[selectedProjectId] ?? [] : []),
    [featuresByProject, selectedProjectId],
  );

  const selectedFeature = useMemo(
    () =>
      Object.values(featuresByProject)
        .flat()
        .find((feature) => feature.id === selectedFeatureId) ?? null,
    [featuresByProject, selectedFeatureId],
  );

  const featureTitleError = featureForm.title.trim()
    ? null
    : 'Feature title is required.';
  const featureAcceptanceCriteriaError = featureForm.acceptanceCriteria.trim()
    ? null
    : 'Acceptance criteria is required.';
  const canSaveFeature = !featureTitleError && !featureAcceptanceCriteriaError;

  const refreshFeaturesTree = useCallback(
    async (
      projectRows: Project[],
      preferredProjectId: string,
      preferredFeatureId?: string,
    ): Promise<Record<string, Feature[]>> => {
      if (projectRows.length === 0) {
        setFeaturesByProject({});
        setSelectedFeatureId('');
        return {};
      }

      const nextTree: Record<string, Feature[]> = {};

      for (const project of projectRows) {
        let result: Awaited<ReturnType<typeof window.qaApi.featureList>>;
        try {
          result = await window.qaApi.featureList(project.id);
        } catch (error) {
          onMessage(`Failed loading features for ${project.name}: ${toErrorMessage(error)}`);
          nextTree[project.id] = [];
          continue;
        }

        if (!result.ok) {
          onMessage(result.error.message);
          nextTree[project.id] = [];
          continue;
        }

        nextTree[project.id] = result.data;
      }

      setFeaturesByProject(nextTree);

      if (preferredFeatureId) {
        const exists = Object.values(nextTree).some((features) =>
          features.some((feature) => feature.id === preferredFeatureId),
        );
        if (exists) {
          setSelectedFeatureId(preferredFeatureId);
          return nextTree;
        }
      }

      const selectedStillExists = Object.values(nextTree).some((features) =>
        features.some((feature) => feature.id === selectedFeatureId),
      );
      if (selectedStillExists) {
        return nextTree;
      }

      const preferredFeatures = nextTree[preferredProjectId] ?? [];
      if (preferredFeatures.length > 0) {
        setSelectedFeatureId(preferredFeatures[0].id);
        return nextTree;
      }

      const firstFeature = projectRows.flatMap((project) => nextTree[project.id] ?? [])[0];
      setSelectedFeatureId(firstFeature?.id ?? '');
      return nextTree;
    },
    [onMessage, selectedFeatureId],
  );

  const selectProject = useCallback(
    (projectId: string): void => {
      const featuresForProject = featuresByProject[projectId] ?? [];
      const nextSelection = resolveProjectFeatureSelection({
        featuresForProject,
        selectedFeatureId,
      });
      setSelectedFeatureId(nextSelection.selectedFeatureId);
      setFeatureFormMode(nextSelection.featureFormMode);
      setFeatureForm(nextSelection.featureForm);
    },
    [featuresByProject, selectedFeatureId],
  );

  const beginCreateFeature = useCallback(() => {
    setSelectedFeatureId('');
    setFeatureFormMode('create');
    setFeatureForm(DEFAULT_FEATURE_FORM);
  }, []);

  const beginEditSelectedFeature = useCallback(
    (featureId?: string) => {
      const targetFeatureId = featureId ?? selectedFeatureId;
      const featureToEdit = Object.values(featuresByProject)
        .flat()
        .find((feature) => feature.id === targetFeatureId);
      if (!featureToEdit) {
        onMessage('Select a feature first.');
        return;
      }

      setSelectedFeatureId(featureToEdit.id);
      setFeatureFormMode('edit');
      setFeatureForm({
        id: featureToEdit.id,
        title: featureToEdit.title,
        acceptanceCriteria: featureToEdit.acceptanceCriteria,
        requirements: featureToEdit.requirements ?? '',
        notes: featureToEdit.notes ?? '',
      });
    },
    [featuresByProject, onMessage, selectedFeatureId],
  );

  const createFeature = useCallback(async (): Promise<Feature | null> => {
    if (!selectedProjectId) {
      onMessage('Select a project first.');
      return null;
    }

    if (!canSaveFeature) {
      onMessage(
        featureTitleError ??
          featureAcceptanceCriteriaError ??
          'Fix feature validation errors.',
      );
      return null;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.featureCreate>>;
    try {
      result = await window.qaApi.featureCreate({
        projectId: selectedProjectId,
        title: featureForm.title.trim(),
        acceptanceCriteria: featureForm.acceptanceCriteria.trim(),
        requirements: featureForm.requirements.trim() || null,
        notes: featureForm.notes.trim() || null,
      });
    } catch (error) {
      onMessage(`Create feature failed: ${toErrorMessage(error)}`);
      return null;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    setFeaturesByProject((previous) => {
      const current = previous[selectedProjectId] ?? [];
      if (current.some((feature) => feature.id === result.data.id)) {
        return previous;
      }

      return {
        ...previous,
        [selectedProjectId]: [result.data, ...current],
      };
    });

    setSelectedFeatureId(result.data.id);
    setFeatureFormMode('edit');
    setFeatureForm({
      id: result.data.id,
      title: result.data.title,
      acceptanceCriteria: result.data.acceptanceCriteria,
      requirements: result.data.requirements ?? '',
      notes: result.data.notes ?? '',
    });

    return result.data;
  }, [
    canSaveFeature,
    featureAcceptanceCriteriaError,
    featureForm.acceptanceCriteria,
    featureForm.notes,
    featureForm.requirements,
    featureForm.title,
    featureTitleError,
    onMessage,
    selectedProjectId,
  ]);

  const updateSelectedFeature = useCallback(async (): Promise<Feature | null> => {
    if (!selectedFeature) {
      onMessage('Select a feature first.');
      return null;
    }

    if (!canSaveFeature) {
      onMessage(
        featureTitleError ??
          featureAcceptanceCriteriaError ??
          'Fix feature validation errors.',
      );
      return null;
    }

    let result: Awaited<ReturnType<typeof window.qaApi.featureUpdate>>;
    try {
      result = await window.qaApi.featureUpdate({
        id: selectedFeature.id,
        projectId: selectedFeature.projectId,
        title: featureForm.title.trim(),
        acceptanceCriteria: featureForm.acceptanceCriteria.trim(),
        requirements: featureForm.requirements.trim() || null,
        notes: featureForm.notes.trim() || null,
      });
    } catch (error) {
      onMessage(`Update feature failed: ${toErrorMessage(error)}`);
      return null;
    }

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    setFeaturesByProject((previous) => {
      const current = previous[result.data.projectId] ?? [];
      const index = current.findIndex((feature) => feature.id === result.data.id);
      if (index === -1) {
        return previous;
      }

      const next = [...current];
      next[index] = result.data;
      return {
        ...previous,
        [result.data.projectId]: next,
      };
    });

    setFeatureFormMode('edit');
    setFeatureForm({
      id: result.data.id,
      title: result.data.title,
      acceptanceCriteria: result.data.acceptanceCriteria,
      requirements: result.data.requirements ?? '',
      notes: result.data.notes ?? '',
    });
    return result.data;
  }, [
    canSaveFeature,
    featureAcceptanceCriteriaError,
    featureForm.acceptanceCriteria,
    featureForm.notes,
    featureForm.requirements,
    featureForm.title,
    featureTitleError,
    onMessage,
    selectedFeature,
  ]);

  const deleteSelectedFeature = useCallback(
    async (
      onFeatureDeleted: () => Promise<void>,
      featureId?: string,
    ): Promise<boolean> => {
      const targetFeatureId = featureId ?? selectedFeatureId;
      if (!targetFeatureId) {
        onMessage('Select a feature first.');
        return false;
      }

      if (!window.confirm('Delete this feature and all related test cases?')) {
        return false;
      }

      let result: Awaited<ReturnType<typeof window.qaApi.featureDelete>>;
      try {
        result = await window.qaApi.featureDelete(targetFeatureId);
      } catch (error) {
        onMessage(`Delete feature failed: ${toErrorMessage(error)}`);
        return false;
      }

      if (!result.ok) {
        onMessage(result.error.message);
        return false;
      }

      await onFeatureDeleted();
      onMessage(result.data ? 'Feature deleted.' : 'Feature was already deleted.');
      return true;
    },
    [onMessage, selectedFeatureId],
  );

  return {
    featuresByProject,
    selectedFeatureId,
    setSelectedFeatureId,
    selectedProjectFeatures,
    selectedFeature,
    featureForm,
    setFeatureForm,
    featureFormMode,
    featureTitleError,
    featureAcceptanceCriteriaError,
    canSaveFeature,
    refreshFeaturesTree,
    selectProject,
    beginCreateFeature,
    beginEditSelectedFeature,
    createFeature,
    updateSelectedFeature,
    deleteSelectedFeature,
  };
}
