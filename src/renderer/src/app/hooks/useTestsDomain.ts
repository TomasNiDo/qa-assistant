import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ActiveRunContext, Feature, TestCase } from '@shared/types';
import { DEFAULT_TEST_FORM, type TestFormState } from '../types';
import { toErrorMessage } from '../utils';

interface UseTestsDomainArgs {
  featuresByProject: Record<string, Feature[]>;
  selectedProjectId: string;
  selectedFeatureId: string;
  activeRunContext: ActiveRunContext | null;
  selectedTestId: string;
  setSelectedTestId: (testId: string) => void;
  onMessage: (message: string) => void;
}

export interface UseTestsDomainResult {
  testCasesByFeature: Record<string, TestCase[]>;
  selectedTestId: string;
  setSelectedTestId: (testId: string) => void;
  selectedFeatureTests: TestCase[];
  selectedTest: TestCase | null;
  selectedTestHasSteps: boolean;
  isTestEditing: boolean;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  testTitleError: string | null;
  canSaveTestCase: boolean;
  autoSaveStatus: 'saving' | 'saved';
  isSelectedTestDeleteBlocked: boolean;
  refreshTestsTree: (
    featuresTree: Record<string, Feature[]>,
    preferredFeatureId: string,
    preferredTestId?: string,
  ) => Promise<Record<string, TestCase[]>>;
  selectFeature: (featureId: string) => void;
  beginCreateTest: () => void;
  saveTestCase: () => Promise<TestCase | null>;
  deleteSelectedTest: (onTestDeleted: () => Promise<void>) => Promise<boolean>;
}

interface SelectTestResolutionInput {
  nextTree: Record<string, TestCase[]>;
  featureRows: Feature[];
  preferredFeatureId: string;
  preferredTestId?: string;
  selectedTestId: string;
}

export function resolveSelectedTestId({
  nextTree,
  featureRows,
  preferredFeatureId,
  preferredTestId,
  selectedTestId,
}: SelectTestResolutionInput): string {
  if (preferredTestId) {
    const exists = Object.values(nextTree).some((tests) =>
      tests.some((test) => test.id === preferredTestId),
    );
    if (exists) {
      return preferredTestId;
    }
  }

  const selectedStillExists = Object.values(nextTree).some((tests) =>
    tests.some((test) => test.id === selectedTestId),
  );
  if (selectedStillExists) {
    return selectedTestId;
  }

  const preferredTests = nextTree[preferredFeatureId] ?? [];
  if (preferredTests.length > 0) {
    return preferredTests[0].id;
  }

  const firstTest = featureRows.flatMap((feature) => nextTree[feature.id] ?? [])[0];
  return firstTest?.id ?? '';
}

export function useTestsDomain({
  featuresByProject,
  selectedProjectId,
  selectedFeatureId,
  activeRunContext,
  selectedTestId,
  setSelectedTestId,
  onMessage,
}: UseTestsDomainArgs): UseTestsDomainResult {
  const [testCasesByFeature, setTestCasesByFeature] = useState<Record<string, TestCase[]>>({});
  const [isTestEditing, setIsTestEditing] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>(DEFAULT_TEST_FORM);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [selectedTestHasSteps, setSelectedTestHasSteps] = useState(false);

  const autoSaveVersion = useRef(0);
  const testFormLoadVersion = useRef(0);
  const lastSavedSignatureRef = useRef('');

  const selectedFeatureTests = useMemo(
    () => (selectedFeatureId ? testCasesByFeature[selectedFeatureId] ?? [] : []),
    [selectedFeatureId, testCasesByFeature],
  );

  const selectedTest = useMemo(
    () => selectedFeatureTests.find((testCase) => testCase.id === selectedTestId) ?? null,
    [selectedFeatureTests, selectedTestId],
  );

  const testTitleError = testForm.title.trim() ? null : 'Test title is required.';
  const canSaveTestCase = Boolean(selectedFeatureId) && !testTitleError;

  const isSelectedTestDeleteBlocked =
    Boolean(selectedTestId) && activeRunContext?.testCaseId === selectedTestId;

  const buildTestSignature = useCallback(
    (
      featureId: string,
      testId: string,
      title: string,
      testType: TestFormState['testType'],
      priority: TestFormState['priority'],
      isAiGenerated: boolean,
    ): string =>
      `${featureId}::${testId}::${title.trim()}::${testType}::${priority}::${
        isAiGenerated ? '1' : '0'
      }`,
    [],
  );

  const refreshTestsTree = useCallback(
    async (
      featuresTree: Record<string, Feature[]>,
      preferredFeatureId: string,
      preferredTestId?: string,
    ): Promise<Record<string, TestCase[]>> => {
      const allFeatures = Object.values(featuresTree).flat();

      if (allFeatures.length === 0) {
        setTestCasesByFeature({});
        setSelectedTestId('');
        return {};
      }

      const nextTree: Record<string, TestCase[]> = {};

      for (const feature of allFeatures) {
        let result: Awaited<ReturnType<typeof window.qaApi.testListByFeature>>;
        try {
          result = await window.qaApi.testListByFeature(feature.id);
        } catch (error) {
          onMessage(
            `Failed loading test cases for feature ${feature.title}: ${toErrorMessage(error)}`,
          );
          nextTree[feature.id] = [];
          continue;
        }

        if (!result.ok) {
          onMessage(result.error.message);
          nextTree[feature.id] = [];
          continue;
        }

        nextTree[feature.id] = result.data;
      }

      setTestCasesByFeature(nextTree);
      setSelectedTestId(
        resolveSelectedTestId({
          nextTree,
          featureRows: allFeatures,
          preferredFeatureId,
          preferredTestId,
          selectedTestId,
        }),
      );

      return nextTree;
    },
    [onMessage, selectedTestId, setSelectedTestId],
  );

  const loadSelectedTestIntoForm = useCallback(async () => {
    const currentLoadVersion = testFormLoadVersion.current + 1;
    testFormLoadVersion.current = currentLoadVersion;

    if (!selectedTest) {
      lastSavedSignatureRef.current = '';
      setAutoSaveStatus('saved');
      setIsTestEditing(false);
      setTestForm(DEFAULT_TEST_FORM);
      setSelectedTestHasSteps(false);
      return;
    }

    let stepRowsResult: Awaited<ReturnType<typeof window.qaApi.stepList>>;
    try {
      stepRowsResult = await window.qaApi.stepList(selectedTest.id);
    } catch (error) {
      onMessage(`Failed loading test steps: ${toErrorMessage(error)}`);
      setSelectedTestHasSteps(false);
      return;
    }

    if (currentLoadVersion !== testFormLoadVersion.current) {
      return;
    }

    if (!stepRowsResult.ok) {
      onMessage(stepRowsResult.error.message);
      setSelectedTestHasSteps(false);
      return;
    }

    setSelectedTestHasSteps(stepRowsResult.data.length > 0);
    lastSavedSignatureRef.current = buildTestSignature(
      selectedTest.featureId,
      selectedTest.id,
      selectedTest.title,
      selectedTest.testType,
      selectedTest.priority,
      selectedTest.isAiGenerated,
    );

    setIsTestEditing(true);
    setAutoSaveStatus('saved');
    setTestForm({
      id: selectedTest.id,
      title: selectedTest.title,
      testType: selectedTest.testType,
      priority: selectedTest.priority,
      isAiGenerated: selectedTest.isAiGenerated,
    });
  }, [buildTestSignature, onMessage, selectedTest]);

  useEffect(() => {
    void loadSelectedTestIntoForm();
  }, [loadSelectedTestIntoForm]);

  const selectFeature = useCallback(
    (featureId: string): void => {
      const testsForFeature = testCasesByFeature[featureId] ?? [];
      if (!testsForFeature.some((testCase) => testCase.id === selectedTestId)) {
        setSelectedTestId(testsForFeature[0]?.id ?? '');
      }
    },
    [selectedTestId, setSelectedTestId, testCasesByFeature],
  );

  const beginCreateTest = useCallback(() => {
    testFormLoadVersion.current += 1;
    lastSavedSignatureRef.current = '';
    setAutoSaveStatus('saved');
    setSelectedTestId('');
    setIsTestEditing(false);
    setSelectedTestHasSteps(false);
    setTestForm(DEFAULT_TEST_FORM);
  }, [setSelectedTestId]);

  const saveTestCase = useCallback(async (): Promise<TestCase | null> => {
    if (!selectedFeatureId) {
      onMessage('Select a feature first.');
      return null;
    }

    if (!canSaveTestCase) {
      onMessage(testTitleError ?? 'Fix invalid test metadata before saving.');
      return null;
    }

    const result =
      isTestEditing && testForm.id
        ? await window.qaApi.testUpdate({
            id: testForm.id,
            featureId: selectedFeatureId,
            title: testForm.title.trim(),
            testType: testForm.testType,
            priority: testForm.priority,
            isAiGenerated: testForm.isAiGenerated,
          })
        : await window.qaApi.testCreate({
            featureId: selectedFeatureId,
            title: testForm.title.trim(),
            testType: testForm.testType,
            priority: testForm.priority,
            isAiGenerated: testForm.isAiGenerated,
          });

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    lastSavedSignatureRef.current = buildTestSignature(
      selectedFeatureId,
      result.data.id,
      result.data.title,
      result.data.testType,
      result.data.priority,
      result.data.isAiGenerated,
    );

    setSelectedTestId(result.data.id);
    setIsTestEditing(true);
    setTestForm({
      id: result.data.id,
      title: result.data.title,
      testType: result.data.testType,
      priority: result.data.priority,
      isAiGenerated: result.data.isAiGenerated,
    });

    setTestCasesByFeature((previous) => {
      const testsForFeature = previous[selectedFeatureId] ?? [];
      const existingIndex = testsForFeature.findIndex(
        (testCase) => testCase.id === result.data.id,
      );
      if (existingIndex >= 0) {
        const updatedTests = [...testsForFeature];
        updatedTests[existingIndex] = result.data;
        return {
          ...previous,
          [selectedFeatureId]: updatedTests,
        };
      }

      return {
        ...previous,
        [selectedFeatureId]: [...testsForFeature, result.data],
      };
    });

    return result.data;
  }, [
    buildTestSignature,
    canSaveTestCase,
    isTestEditing,
    onMessage,
    selectedFeatureId,
    setSelectedTestId,
    testForm.id,
    testForm.isAiGenerated,
    testForm.priority,
    testForm.testType,
    testForm.title,
    testTitleError,
  ]);

  useEffect(() => {
    if (!selectedFeatureId || !canSaveTestCase) {
      setAutoSaveStatus('saved');
      return;
    }

    const currentSignature = buildTestSignature(
      selectedFeatureId,
      testForm.id,
      testForm.title,
      testForm.testType,
      testForm.priority,
      testForm.isAiGenerated,
    );

    if (currentSignature === lastSavedSignatureRef.current) {
      setAutoSaveStatus('saved');
      return;
    }

    const currentAutoSaveVersion = autoSaveVersion.current + 1;
    autoSaveVersion.current = currentAutoSaveVersion;
    setAutoSaveStatus('saving');

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        await saveTestCase();
        if (currentAutoSaveVersion === autoSaveVersion.current) {
          setAutoSaveStatus('saved');
        }
      })();
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    buildTestSignature,
    canSaveTestCase,
    saveTestCase,
    selectedFeatureId,
    testForm.id,
    testForm.isAiGenerated,
    testForm.priority,
    testForm.testType,
    testForm.title,
  ]);

  const deleteSelectedTest = useCallback(
    async (onTestDeleted: () => Promise<void>): Promise<boolean> => {
      if (!selectedTestId) {
        onMessage('Select a test case first.');
        return false;
      }

      if (activeRunContext?.testCaseId === selectedTestId) {
        onMessage('Cannot delete this test case while it is running.');
        return false;
      }

      if (!window.confirm('Delete this test case?')) {
        return false;
      }

      const result = await window.qaApi.testDelete(selectedTestId);
      if (!result.ok) {
        onMessage(result.error.message);
        return false;
      }

      await onTestDeleted();
      onMessage(result.data ? 'Test case deleted.' : 'Test case was already deleted.');
      return true;
    },
    [activeRunContext?.testCaseId, onMessage, selectedTestId],
  );

  useEffect(() => {
    const projectIds = new Set(Object.keys(featuresByProject));
    const validFeatureIds = new Set(
      Object.values(featuresByProject)
        .flat()
        .map((feature) => feature.id),
    );

    setTestCasesByFeature((previous) => {
      const next: Record<string, TestCase[]> = {};
      for (const featureId of Object.keys(previous)) {
        if (validFeatureIds.has(featureId)) {
          next[featureId] = previous[featureId];
        }
      }
      return next;
    });

    if (!projectIds.has(selectedProjectId)) {
      setSelectedTestId('');
    }
  }, [featuresByProject, selectedProjectId, setSelectedTestId]);

  return {
    testCasesByFeature,
    selectedTestId,
    setSelectedTestId,
    selectedFeatureTests,
    selectedTest,
    selectedTestHasSteps,
    isTestEditing,
    testForm,
    setTestForm,
    testTitleError,
    canSaveTestCase,
    autoSaveStatus,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectFeature,
    beginCreateTest,
    saveTestCase,
    deleteSelectedTest,
  };
}
