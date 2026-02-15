import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '../aiService';

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

class AIServiceTestDb {
  constructor(
    private readonly runRow:
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
      | undefined,
    private readonly steps: Array<{ id: string; raw_text: string; step_order: number }> = [],
    private readonly stepResults: Array<{
      step_id: string;
      status: string;
      error_text: string | null;
      screenshot_path: string | null;
    }> = [],
  ) {}

  prepare(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => { changes: number };
  } {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (
      normalized.includes('FROM runs') &&
      normalized.includes('JOIN test_cases ON test_cases.id = runs.test_case_id') &&
      normalized.includes('JOIN projects ON projects.id = test_cases.project_id')
    ) {
      return {
        get: (...args) => {
          const [runId] = args as [string];
          if (!this.runRow || this.runRow.id !== runId) {
            return undefined;
          }
          return this.runRow;
        },
        all: () => [],
        run: () => ({ changes: 0 }),
      };
    }

    if (normalized.includes('SELECT id, raw_text, step_order FROM steps')) {
      return {
        get: () => undefined,
        all: () => this.steps,
        run: () => ({ changes: 0 }),
      };
    }

    if (normalized.includes('SELECT step_id, status, error_text, screenshot_path FROM step_results')) {
      return {
        get: () => undefined,
        all: () => this.stepResults,
        run: () => ({ changes: 0 }),
      };
    }

    throw new Error(`Unsupported SQL in AIServiceTestDb: ${normalized}`);
  }
}

function geminiSuccessResponse(text: string): Response {
  const payload: GeminiPayload = {
    candidates: [{ content: { parts: [{ text }] } }],
  };

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function geminiErrorResponse(status: number, statusText: string, body = ''): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

describe('AIService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback steps when API key is not configured', async () => {
    const service = new AIService({} as Database.Database, undefined);
    const result = await service.generateSteps({
      title: 'Checkout flow',
      baseUrl: 'https://example.com',
    });

    expect(result).toHaveLength(2);
    expect(result[0].rawText).toContain('Checkout flow');
  });

  it('retries transient Gemini failures and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiErrorResponse(503, 'Service Unavailable'))
      .mockResolvedValueOnce(
        geminiSuccessResponse('{"steps":[{"rawText":"Click \\"Login\\"","reason":"primary CTA"}]}'),
      );

    const service = new AIService({} as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 2,
      requestTimeoutMs: 50,
    });

    const result = await service.generateSteps({
      title: 'Login flow',
      baseUrl: 'https://example.com',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        rawText: 'Click "Login"',
        reason: 'primary CTA',
        isDestructive: false,
      },
    ]);
  });

  it('fails with classified timeout message', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });

    const service = new AIService({} as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 0,
      requestTimeoutMs: 20,
    });

    await expect(
      service.generateSteps({
        title: 'Login flow',
        baseUrl: 'https://example.com',
      }),
    ).rejects.toThrow('AI step generation timed out. Please retry.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses bounded retries and returns classified service-unavailable error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiErrorResponse(503, 'Service Unavailable'));

    const service = new AIService({} as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 2,
      requestTimeoutMs: 50,
    });

    await expect(
      service.generateSteps({
        title: 'Login flow',
        baseUrl: 'https://example.com',
      }),
    ).rejects.toThrow('AI step generation is temporarily unavailable. Please retry.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('classifies malformed model JSON for step generation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiSuccessResponse('output without JSON object'));

    const service = new AIService({} as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 0,
      requestTimeoutMs: 50,
    });

    await expect(
      service.generateSteps({
        title: 'Login flow',
        baseUrl: 'https://example.com',
      }),
    ).rejects.toThrow(
      'AI step generation returned an unexpected format. Try again with more specific input.',
    );
  });

  it('classifies unsupported generated steps as model-format errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        geminiSuccessResponse('{"steps":[{"rawText":"Do quantum shuffle now","reason":"creative"}]}'),
      );

    const service = new AIService({} as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 0,
      requestTimeoutMs: 50,
    });

    await expect(
      service.generateSteps({
        title: 'Login flow',
        baseUrl: 'https://example.com',
      }),
    ).rejects.toThrow(
      'AI step generation returned an unexpected format. Try again with more specific input.',
    );
  });

  it('classifies malformed bug report JSON response', async () => {
    const db = new AIServiceTestDb(
      {
        id: 'run-1',
        browser: 'chromium',
        status: 'failed',
        started_at: '2025-01-01T00:00:00.000Z',
        ended_at: '2025-01-01T00:01:00.000Z',
        test_title: 'Checkout flow',
        project_name: 'Checkout',
        base_url: 'https://example.com',
        env_label: 'local',
      },
      [{ id: 'step-1', raw_text: 'Click "Checkout"', step_order: 1 }],
      [{ step_id: 'step-1', status: 'failed', error_text: 'timed out', screenshot_path: null }],
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiSuccessResponse('not JSON content from model'));

    const service = new AIService(db as unknown as Database.Database, 'test-key', 'gemini-2.5-flash', {
      fetchFn: fetchMock as unknown as typeof fetch,
      delay: async () => undefined,
      maxRetries: 0,
      requestTimeoutMs: 50,
    });

    await expect(service.generateBugReport({ runId: 'run-1' })).rejects.toThrow(
      'AI bug report generation returned an unexpected format. Try again with more specific input.',
    );
  });
});
