import type Database from 'better-sqlite3';
import type {
  GenerateBugReportInput,
  GenerateStepsInput,
  GeneratedBugReport,
  GeneratedStep,
  Step,
  StepResult,
} from '@shared/types';
import { parseStep } from './parserService';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const RISKY_VERBS = ['delete', 'remove', 'purchase', 'buy', 'transfer', 'submit order'];

interface GeminiTextResponse {
  text: string;
}

export class AIService {
  constructor(
    private readonly db: Database.Database,
    private readonly apiKey: string | undefined,
    private readonly model = DEFAULT_MODEL,
  ) {}

  async generateSteps(input: GenerateStepsInput): Promise<GeneratedStep[]> {
    if (!this.apiKey) {
      return this.fallbackSteps(input.title);
    }

    const prompt = [
      'You are a QA automation assistant for a desktop app that supports only these step types:',
      '1) Enter "<value>" in "<field>" field',
      '2) Click "<text>"',
      '3) Expect <assertion>',
      'Return strict JSON with shape: {"steps":[{"rawText":string,"reason":string}]}.',
      'No markdown fences.',
      `Test title: ${input.title}`,
      `Base URL: ${input.baseUrl}`,
      `Metadata: ${input.metadataJson ?? '{}'}`,
    ].join('\n');

    const response = await this.callGemini(prompt);
    const parsed = parseJsonObject(response.text);
    const rows = (parsed.steps ?? []) as Array<{ rawText?: string; reason?: string }>;

    const generated = rows
      .filter((row) => typeof row.rawText === 'string')
      .map((row) => {
        const rawText = row.rawText!.trim();
        const parseResult = parseStep(rawText);

        if (!parseResult.ok) {
          throw new Error(`AI produced unsupported step: ${rawText}`);
        }

        return {
          rawText,
          reason: row.reason?.trim() || 'Generated from title context',
          isDestructive: isDestructive(rawText),
        } satisfies GeneratedStep;
      });

    if (generated.length === 0) {
      throw new Error('AI did not return usable steps.');
    }

    return generated;
  }

  async generateBugReport(input: GenerateBugReportInput): Promise<GeneratedBugReport> {
    const run = this.db
      .prepare(
        `SELECT runs.id, runs.browser, runs.status, runs.started_at, runs.ended_at,
                test_cases.title AS test_title,
                projects.name AS project_name,
                projects.base_url AS base_url,
                projects.env_label AS env_label
         FROM runs
         JOIN test_cases ON test_cases.id = runs.test_case_id
         JOIN projects ON projects.id = test_cases.project_id
         WHERE runs.id = ?`,
      )
      .get(input.runId) as
      | {
          id: string;
          browser: string;
          status: string;
          started_at: string;
          ended_at: string | null;
          test_title: string;
          project_name: string;
          base_url: string;
          env_label: string;
        }
      | undefined;

    if (!run) {
      throw new Error('Run not found.');
    }

    if (run.status !== 'failed') {
      throw new Error('Bug reports can only be generated for failed runs.');
    }

    const steps = this.db
      .prepare(
        `SELECT id, raw_text, step_order
         FROM steps
         WHERE test_case_id = (
          SELECT test_case_id FROM runs WHERE id = ?
         )
         ORDER BY step_order ASC`,
      )
      .all(input.runId) as Array<{ id: string; raw_text: string; step_order: number }>;

    const stepResults = this.db
      .prepare(
        `SELECT step_id, status, error_text, screenshot_path
         FROM step_results
         WHERE run_id = ?`,
      )
      .all(input.runId) as Array<{
      step_id: string;
      status: string;
      error_text: string | null;
      screenshot_path: string | null;
    }>;

    const joined = joinStepContext(steps, stepResults);

    if (!this.apiKey) {
      return fallbackBugReport(run.project_name, run.base_url, run.env_label, run.browser, joined);
    }

    const prompt = [
      'Generate a Jira-friendly bug report as strict JSON.',
      'Schema:',
      '{"title":string,"environment":string,"stepsToReproduce":string[],"expectedResult":string,"actualResult":string,"evidence":string[]}',
      'Use explicit TODO placeholders if data is missing.',
      `Project: ${run.project_name}`,
      `Base URL: ${run.base_url}`,
      `Environment label: ${run.env_label}`,
      `Browser: ${run.browser}`,
      `Run started: ${run.started_at}`,
      `Run ended: ${run.ended_at ?? 'TODO: ended_at missing'}`,
      `Step outcomes JSON: ${JSON.stringify(joined)}`,
    ].join('\n');

    const response = await this.callGemini(prompt);
    const parsed = parseJsonObject(response.text);

    return {
      title: ensureString(parsed.title, 'TODO: add concise bug title'),
      environment: ensureString(
        parsed.environment,
        `${run.env_label} | ${run.browser} | ${run.base_url}`,
      ),
      stepsToReproduce: ensureStringArray(parsed.stepsToReproduce, joined.map((item) => item.rawText)),
      expectedResult: ensureString(parsed.expectedResult, 'TODO: expected behavior'),
      actualResult: ensureString(parsed.actualResult, joined.find((item) => item.errorText)?.errorText || ''),
      evidence: ensureStringArray(
        parsed.evidence,
        joined.map((item) => item.screenshotPath).filter((path): path is string => Boolean(path)),
      ),
    };
  }

  private async callGemini(prompt: string): Promise<GeminiTextResponse> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return { text };
  }

  private fallbackSteps(title: string): GeneratedStep[] {
    const sanitized = title.trim() || 'Untitled test case';
    return [
      {
        rawText: `Click "${sanitized}"`,
        reason: 'Fallback when GEMINI_API_KEY is not configured.',
        isDestructive: false,
      },
      {
        rawText: 'Expect page updates correctly',
        reason: 'Fallback expectation',
        isDestructive: false,
      },
    ];
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const blockMatch = text.match(/\{[\s\S]*\}/);
  const candidate = blockMatch ? blockMatch[0] : text;
  const parsed = JSON.parse(candidate) as Record<string, unknown>;
  return parsed;
}

function ensureString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function ensureStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback.length > 0 ? fallback : ['TODO: no data provided'];
  }

  const out = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return out.length > 0 ? out : fallback.length > 0 ? fallback : ['TODO: no data provided'];
}

function isDestructive(rawText: string): boolean {
  const normalized = rawText.toLowerCase();
  return RISKY_VERBS.some((verb) => normalized.includes(verb));
}

function joinStepContext(
  steps: Array<{ id: string; raw_text: string; step_order: number }> | Step[],
  stepResults: Array<{ step_id: string; status: string; error_text: string | null; screenshot_path: string | null }> | StepResult[],
): Array<{ rawText: string; status: string; errorText: string | null; screenshotPath: string | null }> {
  const normalizedSteps = steps.map((step) => ({
    id: step.id,
    rawText: 'raw_text' in step ? step.raw_text : step.rawText,
    order: 'step_order' in step ? step.step_order : step.stepOrder,
  }));

  const normalizedResults = stepResults.map((result) => {
    if ('step_id' in result) {
      return {
        stepId: result.step_id,
        status: result.status,
        errorText: result.error_text,
        screenshotPath: result.screenshot_path,
      };
    }

    return {
      stepId: result.stepId,
      status: result.status,
      errorText: result.errorText,
      screenshotPath: result.screenshotPath,
    };
  });

  const resultByStepId = new Map(
    normalizedResults.map((result) => [
      result.stepId,
      {
        status: result.status,
        errorText: result.errorText,
        screenshotPath: result.screenshotPath,
      },
    ]),
  );

  return normalizedSteps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const result = resultByStepId.get(step.id);
      return {
        rawText: step.rawText,
        status: result?.status ?? 'unknown',
        errorText: result?.errorText ?? 'TODO: no error captured',
        screenshotPath: result?.screenshotPath ?? 'TODO: no screenshot path captured',
      };
    });
}

function fallbackBugReport(
  projectName: string,
  baseUrl: string,
  envLabel: string,
  browser: string,
  steps: Array<{ rawText: string; status: string; errorText: string | null; screenshotPath: string | null }>,
): GeneratedBugReport {
  return {
    title: `[${projectName}] Failure in ${browser}`,
    environment: `${envLabel} | ${browser} | ${baseUrl}`,
    stepsToReproduce: steps.map((item) => item.rawText),
    expectedResult: 'Flow should complete without errors.',
    actualResult:
      steps.find((item) => item.status === 'failed')?.errorText || 'TODO: add failure details from run output',
    evidence: steps
      .map((item) => item.screenshotPath)
      .filter((value): value is string => Boolean(value)),
  };
}
