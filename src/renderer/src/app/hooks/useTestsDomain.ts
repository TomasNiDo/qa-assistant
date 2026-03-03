import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  ActiveRunContext,
  CustomCodeSyntaxValidationResult,
  Feature,
  StepParseResult,
  StepParseWarning,
  TestCase,
} from '@shared/types';
import { DEFAULT_TEST_FORM, type TestFormState } from '../types';
import { parseStepLines, toErrorMessage } from '../utils';

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
  parsedSteps: string[];
  stepParsePreview: StepParseResult[];
  isValidatingSteps: boolean;
  isGeneratingSteps: boolean;
  isValidatingCustomCode: boolean;
  testTitleError: string | null;
  customCodeError: string | null;
  testStepsErrors: Array<string | null>;
  stepParseWarnings: StepParseWarning[][];
  ambiguousStepWarningCount: number;
  hasStepErrors: boolean;
  effectiveCode: string;
  isCodeModified: boolean;
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
  setEditorView: (view: TestFormState['activeView']) => void;
  enableCodeEditing: () => void;
  updateCodeDraft: (nextCode: string) => void;
  restoreGeneratedCode: () => void;
  saveTestCase: () => Promise<TestCase | null>;
  deleteSelectedTest: (onTestDeleted: () => Promise<void>) => Promise<boolean>;
  generateSteps: () => Promise<void>;
}

interface SelectTestResolutionInput {
  nextTree: Record<string, TestCase[]>;
  featureRows: Feature[];
  preferredFeatureId: string;
  preferredTestId?: string;
  selectedTestId: string;
}

export function getStepParseErrors(
  parsedSteps: string[],
  stepParsePreview: StepParseResult[],
  isValidatingSteps: boolean,
): Array<string | null> {
  return parsedSteps.map((stepText, index) => {
    const rawStep = stepText.trim();
    if (!rawStep) {
      return 'Step cannot be empty.';
    }

    const parsed = stepParsePreview[index];
    if (!parsed) {
      return isValidatingSteps ? 'Validating step...' : 'Validation unavailable.';
    }

    return parsed.ok ? null : parsed.error;
  });
}

export function getStepParseWarnings(
  parsedSteps: string[],
  stepParsePreview: StepParseResult[],
): StepParseWarning[][] {
  return parsedSteps.map((_stepText, index) => {
    const parsed = stepParsePreview[index];
    if (!parsed || !parsed.ok) {
      return [];
    }

    return parsed.warnings ?? [];
  });
}

export function formatCustomCodeSyntaxError(
  validation: CustomCodeSyntaxValidationResult,
): string | null {
  if (validation.valid) {
    return null;
  }

  return validation.message ?? 'Custom code syntax is invalid.';
}

export function getCustomCodeError(
  isCustomized: boolean,
  customCode: string,
  customCodeSyntaxError: string | null,
): string | null {
  if (!isCustomized) {
    return null;
  }

  if (!customCode.trim()) {
    return 'Custom code cannot be empty when customization is enabled.';
  }

  return customCodeSyntaxError;
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
  const [stepParsePreview, setStepParsePreview] = useState<StepParseResult[]>([]);
  const [isValidatingSteps, setIsValidatingSteps] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [selectedTestHasSteps, setSelectedTestHasSteps] = useState(false);

  const stepValidationVersion = useRef(0);
  const customCodeValidationVersion = useRef(0);
  const autoSaveVersion = useRef(0);
  const testFormLoadVersion = useRef(0);
  const lastSavedSignatureRef = useRef('');
  const [customCodeSyntaxError, setCustomCodeSyntaxError] = useState<string | null>(null);
  const [isValidatingCustomCode, setIsValidatingCustomCode] = useState(false);

  const selectedFeatureTests = useMemo(
    () => (selectedFeatureId ? testCasesByFeature[selectedFeatureId] ?? [] : []),
    [selectedFeatureId, testCasesByFeature],
  );

  const selectedTest = useMemo(
    () => selectedFeatureTests.find((testCase) => testCase.id === selectedTestId) ?? null,
    [selectedFeatureTests, selectedTestId],
  );

  const parsedSteps = useMemo(() => parseStepLines(testForm.stepsText), [testForm.stepsText]);
  const effectiveCode = useMemo(
    () => (testForm.isCustomized ? testForm.customCode : testForm.generatedCode),
    [testForm.customCode, testForm.generatedCode, testForm.isCustomized],
  );
  const isCodeModified = useMemo(
    () =>
      testForm.isCustomized && testForm.customCode.trim() !== testForm.generatedCode.trim(),
    [testForm.customCode, testForm.generatedCode, testForm.isCustomized],
  );

  const testTitleError = testForm.title.trim() ? null : 'Test title is required.';
  const customCodeError = getCustomCodeError(
    testForm.isCustomized,
    testForm.customCode,
    customCodeSyntaxError,
  );
  const testStepsErrors = getStepParseErrors(parsedSteps, stepParsePreview, isValidatingSteps);
  const stepParseWarnings = getStepParseWarnings(parsedSteps, stepParsePreview);
  const ambiguousStepWarningCount = stepParseWarnings.reduce(
    (count, warnings) => count + warnings.length,
    0,
  );
  const hasStepErrors = testStepsErrors.some(Boolean) || parsedSteps.length === 0;
  const canSaveTestCase =
    Boolean(selectedFeatureId) &&
    !testTitleError &&
    !customCodeError &&
    !isValidatingCustomCode &&
    !hasStepErrors &&
    !isValidatingSteps;

  const isSelectedTestDeleteBlocked =
    Boolean(selectedTestId) && activeRunContext?.testCaseId === selectedTestId;

  const buildTestSignature = useCallback(
    (
      featureId: string,
      testId: string,
      title: string,
      steps: string[],
      testType: TestFormState['testType'],
      priority: TestFormState['priority'],
      planningStatus: TestCase['planningStatus'],
      isAiGenerated: boolean,
      isCustomized: boolean,
      customCode: string,
    ): string =>
      `${featureId}::${testId}::${title.trim()}::${steps.join('\n')}::${testType}::${priority}::${planningStatus}::${
        isAiGenerated ? '1' : '0'
      }::${isCustomized ? '1' : '0'}::${isCustomized ? customCode : ''}`,
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
    const loadedStepsText = stepRowsResult.data.map((step) => step.rawText).join('\n');
    lastSavedSignatureRef.current = buildTestSignature(
      selectedTest.featureId,
      selectedTest.id,
      selectedTest.title,
      parseStepLines(loadedStepsText),
      selectedTest.testType,
      selectedTest.priority,
      selectedTest.planningStatus,
      selectedTest.isAiGenerated,
      selectedTest.isCustomized,
      selectedTest.customCode ?? '',
    );

    setIsTestEditing(true);
    setAutoSaveStatus('saved');
    setTestForm((previous) => {
      const isSameTest = previous.id === selectedTest.id;
      return {
        id: selectedTest.id,
        title: selectedTest.title,
        testType: selectedTest.testType,
        priority: selectedTest.priority,
        isAiGenerated: selectedTest.isAiGenerated,
        stepsText: loadedStepsText,
        generatedCode: selectedTest.generatedCode,
        customCode: selectedTest.customCode ?? '',
        isCustomized: selectedTest.isCustomized,
        isCodeEditingEnabled: isSameTest
          ? previous.isCodeEditingEnabled && selectedTest.isCustomized
          : false,
        activeView: isSameTest ? previous.activeView : 'steps',
      };
    });
  }, [buildTestSignature, onMessage, selectedTest]);

  useEffect(() => {
    void loadSelectedTestIntoForm();
  }, [loadSelectedTestIntoForm]);

  useEffect(() => {
    const version = stepValidationVersion.current + 1;
    stepValidationVersion.current = version;
    setIsValidatingSteps(true);

    if (parsedSteps.length === 0) {
      setStepParsePreview([]);
      setIsValidatingSteps(false);
      return;
    }

    void (async () => {
      const results: StepParseResult[] = [];
      for (const stepText of parsedSteps) {
        const rawStep = stepText.trim();
        if (!rawStep) {
          results.push({ ok: false, error: 'Step cannot be empty.' });
          continue;
        }

        const parsed = await window.qaApi.stepParse(rawStep);
        if (!parsed.ok) {
          results.push({ ok: false, error: parsed.error.message });
          continue;
        }
        results.push(parsed.data);
      }

      if (version !== stepValidationVersion.current) {
        return;
      }

      setStepParsePreview(results);
      setIsValidatingSteps(false);
    })();
  }, [parsedSteps]);

  useEffect(() => {
    const version = customCodeValidationVersion.current + 1;
    customCodeValidationVersion.current = version;

    if (!testForm.isCustomized || !testForm.customCode.trim()) {
      setCustomCodeSyntaxError(null);
      setIsValidatingCustomCode(false);
      return;
    }

    setIsValidatingCustomCode(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const validation = await window.qaApi.testValidateCustomCodeSyntax(testForm.customCode);
        if (version !== customCodeValidationVersion.current) {
          return;
        }

        if (!validation.ok) {
          setCustomCodeSyntaxError(validation.error.message);
          setIsValidatingCustomCode(false);
          return;
        }

        setCustomCodeSyntaxError(formatCustomCodeSyntaxError(validation.data));
        setIsValidatingCustomCode(false);
      })();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [testForm.customCode, testForm.isCustomized]);

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

  const setEditorView = useCallback((view: TestFormState['activeView']) => {
    setTestForm((previous) => ({ ...previous, activeView: view }));
  }, []);

  const enableCodeEditing = useCallback(() => {
    setTestForm((previous) => ({ ...previous, isCodeEditingEnabled: true }));
  }, []);

  const updateCodeDraft = useCallback((nextCode: string) => {
    setTestForm((previous) => {
      if (!previous.isCodeEditingEnabled) {
        return previous;
      }

      if (!previous.isCustomized) {
        const hasDiverged = nextCode !== previous.generatedCode;
        return {
          ...previous,
          isCustomized: hasDiverged,
          customCode: hasDiverged ? nextCode : '',
        };
      }

      return {
        ...previous,
        customCode: nextCode,
      };
    });
  }, []);

  const restoreGeneratedCode = useCallback(() => {
    setTestForm((previous) => ({
      ...previous,
      isCustomized: false,
      customCode: '',
      isCodeEditingEnabled: false,
    }));
  }, []);

  const saveTestCase = useCallback(async (): Promise<TestCase | null> => {
    if (!selectedFeatureId) {
      onMessage('Select a feature first.');
      return null;
    }

    if (!canSaveTestCase) {
      onMessage(testTitleError ?? customCodeError ?? 'Fix invalid steps before saving.');
      return null;
    }

    const cleanSteps = parseStepLines(testForm.stepsText);
    const nextCustomCode = testForm.isCustomized ? testForm.customCode : null;

    const result =
      isTestEditing && testForm.id
        ? await window.qaApi.testUpdate({
            id: testForm.id,
            featureId: selectedFeatureId,
            title: testForm.title.trim(),
            testType: testForm.testType,
            priority: testForm.priority,
            planningStatus: selectedTest?.planningStatus ?? 'drafted',
            isAiGenerated: testForm.isAiGenerated,
            steps: cleanSteps,
            customCode: nextCustomCode,
            isCustomized: testForm.isCustomized,
          })
        : await window.qaApi.testCreate({
            featureId: selectedFeatureId,
            title: testForm.title.trim(),
            testType: testForm.testType,
            priority: testForm.priority,
            planningStatus: selectedTest?.planningStatus ?? 'drafted',
            isAiGenerated: testForm.isAiGenerated,
            steps: cleanSteps,
            customCode: nextCustomCode,
            isCustomized: testForm.isCustomized,
          });

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    lastSavedSignatureRef.current = buildTestSignature(
      selectedFeatureId,
      result.data.id,
      result.data.title,
      cleanSteps,
      result.data.testType,
      result.data.priority,
      result.data.planningStatus,
      result.data.isAiGenerated,
      result.data.isCustomized,
      result.data.customCode ?? '',
    );

    setSelectedTestId(result.data.id);
    setIsTestEditing(true);
    setSelectedTestHasSteps(cleanSteps.length > 0);
    setTestForm((previous) => ({
      ...previous,
      id: result.data.id,
      title: result.data.title,
      testType: result.data.testType,
      priority: result.data.priority,
      isAiGenerated: result.data.isAiGenerated,
      stepsText: cleanSteps.join('\n'),
      generatedCode: result.data.generatedCode,
      customCode: result.data.customCode ?? '',
      isCustomized: result.data.isCustomized,
      isCodeEditingEnabled: previous.isCodeEditingEnabled && result.data.isCustomized,
    }));

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
    customCodeError,
    isTestEditing,
    onMessage,
    selectedFeatureId,
    selectedTest?.planningStatus,
    setSelectedTestId,
    testForm.customCode,
    testForm.id,
    testForm.isAiGenerated,
    testForm.isCustomized,
    testForm.priority,
    testForm.stepsText,
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
      parseStepLines(testForm.stepsText),
      testForm.testType,
      testForm.priority,
      selectedTest?.planningStatus ?? 'drafted',
      testForm.isAiGenerated,
      testForm.isCustomized,
      testForm.customCode,
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
    testForm.isCustomized,
    testForm.priority,
    testForm.customCode,
    testForm.stepsText,
    testForm.testType,
    testForm.title,
    selectedTest?.planningStatus,
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

  const generateSteps = useCallback(async (): Promise<void> => {
    if (isGeneratingSteps) {
      return;
    }

    const selectedFeature = Object.values(featuresByProject)
      .flat()
      .find((feature) => feature.id === selectedFeatureId);
    const testTitle = testForm.title.trim();

    if (!selectedFeature || !selectedProjectId) {
      onMessage('Create or select a project first.');
      return;
    }

    if (!testTitle) {
      onMessage('Enter a test title before generating steps.');
      return;
    }

    const projectFromTree = Object.entries(featuresByProject).find(([projectId, features]) => {
      if (projectId !== selectedProjectId) {
        return false;
      }
      return features.some((feature) => feature.id === selectedFeature.id);
    });

    if (!projectFromTree) {
      onMessage('Project context missing for AI step generation.');
      return;
    }

    setIsGeneratingSteps(true);
    try {
      const projectResult = await window.qaApi.projectList();
      if (!projectResult.ok) {
        onMessage(projectResult.error.message);
        return;
      }

      const selectedProject = projectResult.data.find(
        (project) => project.id === selectedProjectId,
      );
      if (!selectedProject) {
        onMessage('Project not found for AI step generation.');
        return;
      }

      const result = await window.qaApi.aiGenerateSteps({
        title: testTitle,
        baseUrl: selectedProject.baseUrl,
        metadataJson: selectedProject.metadataJson,
      });

      if (!result.ok) {
        onMessage(result.error.message);
        return;
      }

      const generatedSteps = result.data
        .map((step) => {
          if (typeof step === 'string') {
            return step.trim();
          }

          const legacyRawText = (step as { rawText?: unknown }).rawText;
          return typeof legacyRawText === 'string' ? legacyRawText.trim() : '';
        })
        .filter((stepText) => Boolean(stepText));

      if (generatedSteps.length === 0) {
        onMessage('AI returned no steps. Try a more specific test title.');
        return;
      }

      setTestForm((previous) => ({
        ...previous,
        stepsText: generatedSteps.join('\n'),
      }));
      onMessage('Generated steps ready for review.');
    } catch (error) {
      onMessage(`Generate steps failed: ${toErrorMessage(error)}`);
    } finally {
      setIsGeneratingSteps(false);
    }
  }, [
    featuresByProject,
    isGeneratingSteps,
    onMessage,
    selectedFeatureId,
    selectedProjectId,
    testForm.title,
  ]);

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
    parsedSteps,
    stepParsePreview,
    isValidatingSteps,
    isGeneratingSteps,
    isValidatingCustomCode,
    testTitleError,
    customCodeError,
    testStepsErrors,
    stepParseWarnings,
    ambiguousStepWarningCount,
    hasStepErrors,
    effectiveCode,
    isCodeModified,
    canSaveTestCase,
    autoSaveStatus,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectFeature,
    beginCreateTest,
    setEditorView,
    enableCodeEditing,
    updateCodeDraft,
    restoreGeneratedCode,
    saveTestCase,
    deleteSelectedTest,
    generateSteps,
  };
}
