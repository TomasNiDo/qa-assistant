import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  ActiveRunContext,
  Project,
  StepParseResult,
  TestCase,
} from '@shared/types';
import { DEFAULT_TEST_FORM, type TestFormState } from '../types';
import { parseStepLines, toErrorMessage } from '../utils';

interface UseTestsDomainArgs {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | null;
  activeRunContext: ActiveRunContext | null;
  selectedTestId: string;
  setSelectedTestId: (testId: string) => void;
  onMessage: (message: string) => void;
}

export interface UseTestsDomainResult {
  testCasesByProject: Record<string, TestCase[]>;
  selectedTestId: string;
  setSelectedTestId: (testId: string) => void;
  selectedProjectTests: TestCase[];
  selectedTest: TestCase | null;
  isTestEditing: boolean;
  testForm: TestFormState;
  setTestForm: Dispatch<SetStateAction<TestFormState>>;
  parsedSteps: string[];
  stepParsePreview: StepParseResult[];
  isValidatingSteps: boolean;
  isGeneratingSteps: boolean;
  testTitleError: string | null;
  testStepsErrors: Array<string | null>;
  hasStepErrors: boolean;
  canSaveTestCase: boolean;
  isSelectedTestDeleteBlocked: boolean;
  refreshTestsTree: (
    projectRows: Project[],
    preferredProjectId: string,
    preferredTestId?: string,
  ) => Promise<Record<string, TestCase[]>>;
  selectProject: (projectId: string) => void;
  beginCreateTest: () => void;
  saveTestCase: () => Promise<TestCase | null>;
  deleteSelectedTest: (onTestDeleted: () => Promise<void>) => Promise<boolean>;
  generateSteps: () => Promise<void>;
}

interface SelectTestResolutionInput {
  nextTree: Record<string, TestCase[]>;
  projectRows: Project[];
  preferredProjectId: string;
  preferredTestId?: string;
  selectedTestId: string;
}

export function resolveSelectedTestId({
  nextTree,
  projectRows,
  preferredProjectId,
  preferredTestId,
  selectedTestId,
}: SelectTestResolutionInput): string {
  if (preferredTestId) {
    const exists = Object.values(nextTree).some((tests) => tests.some((test) => test.id === preferredTestId));
    if (exists) {
      return preferredTestId;
    }
  }

  const selectedStillExists = Object.values(nextTree).some((tests) => tests.some((test) => test.id === selectedTestId));
  if (selectedStillExists) {
    return selectedTestId;
  }

  const preferredTests = nextTree[preferredProjectId] ?? [];
  if (preferredTests.length > 0) {
    return preferredTests[0].id;
  }

  const firstTest = projectRows.flatMap((project) => nextTree[project.id] ?? [])[0];
  return firstTest?.id ?? '';
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

export function useTestsDomain({
  projects,
  selectedProjectId,
  selectedProject,
  activeRunContext,
  selectedTestId,
  setSelectedTestId,
  onMessage,
}: UseTestsDomainArgs): UseTestsDomainResult {
  const [testCasesByProject, setTestCasesByProject] = useState<Record<string, TestCase[]>>({});
  const [isTestEditing, setIsTestEditing] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>(DEFAULT_TEST_FORM);
  const [stepParsePreview, setStepParsePreview] = useState<StepParseResult[]>([]);
  const [isValidatingSteps, setIsValidatingSteps] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);

  const stepValidationVersion = useRef(0);
  const testFormLoadVersion = useRef(0);

  const selectedProjectTests = useMemo(
    () => (selectedProjectId ? testCasesByProject[selectedProjectId] ?? [] : []),
    [selectedProjectId, testCasesByProject],
  );

  const selectedTest = useMemo(
    () => selectedProjectTests.find((testCase) => testCase.id === selectedTestId) ?? null,
    [selectedProjectTests, selectedTestId],
  );

  const parsedSteps = useMemo(() => parseStepLines(testForm.stepsText), [testForm.stepsText]);

  const testTitleError = testForm.title.trim() ? null : 'Test title is required.';
  const testStepsErrors = getStepParseErrors(parsedSteps, stepParsePreview, isValidatingSteps);
  const hasStepErrors = testStepsErrors.some(Boolean) || parsedSteps.length === 0;
  const canSaveTestCase = Boolean(selectedProjectId) && !testTitleError && !hasStepErrors && !isValidatingSteps;

  const isSelectedTestDeleteBlocked = Boolean(selectedTestId) && activeRunContext?.testCaseId === selectedTestId;

  const refreshTestsTree = useCallback(
    async (
      projectRows: Project[],
      preferredProjectId: string,
      preferredTestId?: string,
    ): Promise<Record<string, TestCase[]>> => {
      if (projectRows.length === 0) {
        setTestCasesByProject({});
        setSelectedTestId('');
        return {};
      }

      const nextTree: Record<string, TestCase[]> = {};

      for (const project of projectRows) {
        let result: Awaited<ReturnType<typeof window.qaApi.testList>>;
        try {
          result = await window.qaApi.testList(project.id);
        } catch (error) {
          onMessage(`Failed loading test cases for ${project.name}: ${toErrorMessage(error)}`);
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

      setTestCasesByProject(nextTree);
      setSelectedTestId(
        resolveSelectedTestId({
          nextTree,
          projectRows,
          preferredProjectId,
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
      setIsTestEditing(false);
      setTestForm(DEFAULT_TEST_FORM);
      return;
    }

    const stepRowsResult = await window.qaApi.stepList(selectedTest.id);
    if (currentLoadVersion !== testFormLoadVersion.current) {
      return;
    }

    if (!stepRowsResult.ok) {
      onMessage(stepRowsResult.error.message);
      return;
    }

    setIsTestEditing(true);
    setTestForm({
      id: selectedTest.id,
      title: selectedTest.title,
      stepsText: stepRowsResult.data.map((step) => step.rawText).join('\n'),
    });
  }, [onMessage, selectedTest]);

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

  const selectProject = useCallback(
    (projectId: string): void => {
      const testsForProject = testCasesByProject[projectId] ?? [];
      if (!testsForProject.some((testCase) => testCase.id === selectedTestId)) {
        setSelectedTestId(testsForProject[0]?.id ?? '');
      }
    },
    [selectedTestId, setSelectedTestId, testCasesByProject],
  );

  const beginCreateTest = useCallback(() => {
    testFormLoadVersion.current += 1;
    setSelectedTestId('');
    setIsTestEditing(false);
    setTestForm(DEFAULT_TEST_FORM);
  }, [setSelectedTestId]);

  const saveTestCase = useCallback(async (): Promise<TestCase | null> => {
    if (!selectedProjectId) {
      onMessage('Select a project first.');
      return null;
    }

    if (!canSaveTestCase) {
      onMessage(testTitleError ?? 'Fix invalid steps before saving.');
      return null;
    }

    const cleanSteps = parseStepLines(testForm.stepsText);

    const result =
      isTestEditing && testForm.id
        ? await window.qaApi.testUpdate({
            id: testForm.id,
            projectId: selectedProjectId,
            title: testForm.title.trim(),
            steps: cleanSteps,
          })
        : await window.qaApi.testCreate({
            projectId: selectedProjectId,
            title: testForm.title.trim(),
            steps: cleanSteps,
          });

    if (!result.ok) {
      onMessage(result.error.message);
      return null;
    }

    setIsTestEditing(true);
    setTestForm({
      id: result.data.id,
      title: result.data.title,
      stepsText: cleanSteps.join('\n'),
    });

    onMessage(isTestEditing ? 'Test case updated.' : 'Test case created.');
    return result.data;
  }, [canSaveTestCase, isTestEditing, onMessage, selectedProjectId, testForm.id, testForm.stepsText, testForm.title, testTitleError]);

  const deleteSelectedTest = useCallback(async (onTestDeleted: () => Promise<void>): Promise<boolean> => {
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
  }, [activeRunContext?.testCaseId, onMessage, selectedTestId]);

  const generateSteps = useCallback(async (): Promise<void> => {
    if (isGeneratingSteps) {
      return;
    }

    if (!selectedProject) {
      onMessage('Create or select a project first.');
      return;
    }

    const testTitle = testForm.title.trim();
    if (!testTitle) {
      onMessage('Enter a test title before generating steps.');
      return;
    }

    setIsGeneratingSteps(true);
    try {
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
        .map((step) => step.rawText.trim())
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
  }, [isGeneratingSteps, onMessage, selectedProject, testForm.title]);

  useEffect(() => {
    const projectIds = new Set(projects.map((project) => project.id));
    setTestCasesByProject((previous) => {
      const next: Record<string, TestCase[]> = {};
      for (const projectId of Object.keys(previous)) {
        if (projectIds.has(projectId)) {
          next[projectId] = previous[projectId];
        }
      }
      return next;
    });
  }, [projects]);

  return {
    testCasesByProject,
    selectedTestId,
    setSelectedTestId,
    selectedProjectTests,
    selectedTest,
    isTestEditing,
    testForm,
    setTestForm,
    parsedSteps,
    stepParsePreview,
    isValidatingSteps,
    isGeneratingSteps,
    testTitleError,
    testStepsErrors,
    hasStepErrors,
    canSaveTestCase,
    isSelectedTestDeleteBlocked,
    refreshTestsTree,
    selectProject,
    beginCreateTest,
    saveTestCase,
    deleteSelectedTest,
    generateSteps,
  };
}
