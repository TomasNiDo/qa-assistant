import type Database from 'better-sqlite3';
import type {
  GenerateBugReportInput,
  GenerateStepsInput,
  GeneratedBugReport,
  GeneratedStep,
  Step,
  StepResult,
} from '@shared/types';
import { z } from 'zod';
import { parseStep } from './parserService';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const RISKY_VERBS = ['delete', 'remove', 'purchase', 'buy', 'transfer', 'submit order'];
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_RETRY_MAX_DELAY_MS = 3_000;

interface GeminiTextResponse {
  text: string;
}

interface AIServiceOptions {
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
}

type AIRequestErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'server_error'
  | 'network_error'
  | 'request_error'
  | 'invalid_response'
  | 'model_output';

class AIRequestError extends Error {
  constructor(
    public readonly code: AIRequestErrorCode,
    message: string,
    public readonly transient: boolean,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'AIRequestError';
  }
}

const generatedStepsResponseSchema = z.object({
  steps: z
    .array(
      z.object({
        rawText: z.string().trim().min(1),
        reason: z.string().optional(),
      }),
    )
    .min(1),
});

const generatedBugReportResponseSchema = z
  .object({
    title: z.string().optional(),
    environment: z.string().optional(),
    stepsToReproduce: z.array(z.string()).optional(),
    expectedResult: z.string().optional(),
    actualResult: z.string().optional(),
    evidence: z.array(z.string()).optional(),
  })
  .passthrough();

export class AIService {
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly db: Database.Database,
    private readonly apiKey: string | undefined,
    private readonly model = DEFAULT_MODEL,
    options: AIServiceOptions = {},
  ) {
    this.requestTimeoutMs = clampPositiveInt(
      options.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS,
      1_000,
      120_000,
    );
    this.maxRetries = clampPositiveInt(options.maxRetries, DEFAULT_MAX_RETRIES, 0, 5);
    this.retryBaseDelayMs = clampPositiveInt(
      options.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
      50,
      10_000,
    );
    this.retryMaxDelayMs = clampPositiveInt(
      options.retryMaxDelayMs,
      DEFAULT_RETRY_MAX_DELAY_MS,
      this.retryBaseDelayMs,
      30_000,
    );
    this.delay = options.delay ?? wait;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async generateSteps(input: GenerateStepsInput): Promise<GeneratedStep[]> {
    if (!this.apiKey) {
      return this.fallbackSteps(input.title);
    }

    const prompt = [
      'You are a QA automation assistant for a desktop app that supports only these step types:',
      '1) Enter "<value>" in "<field>" field',
      '2) Click "<text>"',
      '3) Go to "<path-or-url>"',
      '4) Expect <assertion>',
      'Return strict JSON with shape: {"steps":[{"rawText":string,"reason":string}]}.',
      'No markdown fences.',
      `Test title: ${input.title}`,
      `Base URL: ${input.baseUrl}`,
      `Metadata: ${input.metadataJson ?? '{}'}`,
    ].join('\n');

    try {
      const response = await this.callGemini(prompt);
      const parsed = parseModelJsonObject(response.text);
      const validated = generatedStepsResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AIRequestError(
          'invalid_response',
          'AI response did not include a valid steps array.',
          false,
        );
      }

      const generated = validated.data.steps.map((row) => {
        const rawText = row.rawText.trim();
        const parseResult = parseStep(rawText);

        if (!parseResult.ok) {
          throw new AIRequestError(
            'model_output',
            `AI produced unsupported step: ${rawText}`,
            false,
          );
        }

        return {
          rawText,
          reason: row.reason?.trim() || 'Generated from title context',
          isDestructive: isDestructive(rawText),
        } satisfies GeneratedStep;
      });

      if (generated.length === 0) {
        throw new AIRequestError('model_output', 'AI did not return usable steps.', false);
      }

      return generated;
    } catch (error) {
      throw toUserFacingAIError('step-generation', error);
    }
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

    try {
      const response = await this.callGemini(prompt);
      const parsed = parseModelJsonObject(response.text);
      const validated = generatedBugReportResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AIRequestError('invalid_response', 'AI bug report response did not match schema.', false);
      }

      return {
        title: ensureString(validated.data.title, 'TODO: add concise bug title'),
        environment: ensureString(
          validated.data.environment,
          `${run.env_label} | ${run.browser} | ${run.base_url}`,
        ),
        stepsToReproduce: ensureStringArray(
          validated.data.stepsToReproduce,
          joined.map((item) => item.rawText),
        ),
        expectedResult: ensureString(validated.data.expectedResult, 'TODO: expected behavior'),
        actualResult: ensureString(
          validated.data.actualResult,
          joined.find((item) => item.errorText)?.errorText || '',
        ),
        evidence: ensureStringArray(
          validated.data.evidence,
          joined.map((item) => item.screenshotPath).filter((path): path is string => Boolean(path)),
        ),
      };
    } catch (error) {
      throw toUserFacingAIError('bug-report', error);
    }
  }

  private async callGemini(prompt: string): Promise<GeminiTextResponse> {
    let lastError: AIRequestError | null = null;
    const attempts = this.maxRetries + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.callGeminiOnce(prompt);
      } catch (error) {
        const normalized = normalizeAIRequestError(error);
        lastError = normalized;

        if (!normalized.transient || attempt === attempts) {
          throw normalized;
        }

        const backoffMs = Math.min(
          this.retryMaxDelayMs,
          this.retryBaseDelayMs * 2 ** (attempt - 1),
        );
        await this.delay(backoffMs);
      }
    }

    throw (
      lastError ??
      new AIRequestError('request_error', 'AI request failed after retries.', false)
    );
  }

  private async callGeminiOnce(prompt: string): Promise<GeminiTextResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const response = await this.fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!response.ok) {
        const bodyText = await safeReadResponseText(response);
        if (response.status === 429) {
          throw new AIRequestError('rate_limited', 'AI provider rate-limited the request.', true);
        }
        if (response.status >= 500) {
          throw new AIRequestError(
            'server_error',
            `AI provider service error (${response.status}).`,
            true,
          );
        }

        throw new AIRequestError(
          'request_error',
          `AI request failed (${response.status} ${response.statusText || 'Unknown status'}).`,
          false,
          bodyText || undefined,
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || !text.trim()) {
        throw new AIRequestError('invalid_response', 'AI returned an empty response.', false);
      }

      return { text };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AIRequestError(
          'timeout',
          `AI request timed out after ${Math.round(this.requestTimeoutMs / 1000)}s.`,
          true,
        );
      }

      throw normalizeAIRequestError(error);
    } finally {
      clearTimeout(timeoutId);
    }
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

function parseModelJsonObject(text: string): Record<string, unknown> {
  const candidate = extractJsonObjectCandidate(text);

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new AIRequestError('invalid_response', 'AI JSON response must be an object.', false);
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AIRequestError) {
      throw error;
    }

    throw new AIRequestError('invalid_response', 'AI returned malformed JSON.', false);
  }
}

function extractJsonObjectCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AIRequestError('invalid_response', 'AI returned empty text.', false);
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const fencedCandidate = fencedMatch?.[1]?.trim();
  if (fencedCandidate?.startsWith('{') && fencedCandidate.endsWith('}')) {
    return fencedCandidate;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const extracted = findFirstJsonObject(trimmed);
  if (!extracted) {
    throw new AIRequestError(
      'invalid_response',
      'AI response did not contain a JSON object.',
      false,
    );
  }

  return extracted;
}

function findFirstJsonObject(input: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
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

function clampPositiveInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value as number)));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function safeReadResponseText(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

function normalizeAIRequestError(error: unknown): AIRequestError {
  if (error instanceof AIRequestError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message || 'Unknown AI request failure.';
    if (/abort|timed out|timeout/i.test(`${error.name} ${message}`)) {
      return new AIRequestError('timeout', message, true);
    }
    if (
      /network|failed to fetch|ECONN|ENOTFOUND|EAI_AGAIN|socket|fetch failed/i.test(
        message,
      )
    ) {
      return new AIRequestError('network_error', message, true);
    }

    return new AIRequestError('request_error', message, false);
  }

  return new AIRequestError('request_error', 'Unknown AI request failure.', false);
}

function toUserFacingAIError(
  operation: 'step-generation' | 'bug-report',
  error: unknown,
): Error {
  if (!(error instanceof AIRequestError)) {
    return error instanceof Error ? error : new Error('Unknown error');
  }

  const operationLabel =
    operation === 'step-generation'
      ? 'AI step generation'
      : 'AI bug report generation';

  if (error.code === 'timeout') {
    return new Error(`${operationLabel} timed out. Please retry.`);
  }

  if (error.code === 'rate_limited') {
    return new Error(`${operationLabel} is temporarily rate-limited. Please wait and retry.`);
  }

  if (error.code === 'server_error' || error.code === 'network_error') {
    return new Error(`${operationLabel} is temporarily unavailable. Please retry.`);
  }

  if (error.code === 'invalid_response' || error.code === 'model_output') {
    return new Error(
      `${operationLabel} returned an unexpected format. Try again with more specific input.`,
    );
  }

  return new Error(error.details ? `${error.message} ${error.details}` : error.message);
}
