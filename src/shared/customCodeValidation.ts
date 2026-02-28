import type { CustomCodeSyntaxValidationResult } from './types';

type AsyncFunctionExecutor = (
  page: unknown,
  baseUrl: string,
  expect: unknown,
  qa: unknown,
) => Promise<unknown>;

const CUSTOM_CODE_LINE_OFFSET = 2;

export function compileCustomCodeBlock(customCode: string): AsyncFunctionExecutor {
  const body = customCode.trim();
  if (!body) {
    throw new Error('Custom code is empty.');
  }

  const AsyncFunction = Object.getPrototypeOf(async function noOp() {
    return undefined;
  }).constructor as new (...args: string[]) => AsyncFunctionExecutor;
  return new AsyncFunction('page', 'baseUrl', 'expect', 'qa', body);
}

export function validateCustomCodeSyntax(customCode: string): CustomCodeSyntaxValidationResult {
  if (!customCode.trim()) {
    return {
      valid: false,
      line: null,
      message: 'Custom code cannot be empty when customization is enabled.',
    };
  }

  try {
    compileCustomCodeBlock(customCode);
    return { valid: true, line: null, message: null };
  } catch (error) {
    return {
      valid: false,
      line: getCustomCodeLineNumber(error),
      message: toMessage(error),
    };
  }
}

export function formatCustomCodeSyntaxError(
  result: CustomCodeSyntaxValidationResult,
): string {
  if (result.valid) {
    return '';
  }

  const message = result.message ?? 'Unknown error';
  if (!result.line) {
    return `Custom code syntax error: ${message}`;
  }

  return `Custom code syntax error at line ${result.line}: ${message}`;
}

export function formatCustomCodeRuntimeError(error: unknown): string {
  const message = toMessage(error);
  const line = getCustomCodeLineNumber(error);
  if (!line) {
    return `Custom code failed: ${message}`;
  }

  return `Custom code failed at line ${line}: ${message}`;
}

export function getCustomCodeLineNumber(error: unknown): number | null {
  if (!(error instanceof Error) || !error.stack) {
    return null;
  }

  const patterns = [/<anonymous>:(\d+):(\d+)/, /eval:(\d+):(\d+)/, /Function:(\d+):(\d+)/];
  for (const pattern of patterns) {
    const match = error.stack.match(pattern);
    if (!match) {
      continue;
    }

    const parsedLine = Number(match[1]);
    if (!Number.isFinite(parsedLine)) {
      continue;
    }

    return Math.max(1, parsedLine - CUSTOM_CODE_LINE_OFFSET);
  }

  return null;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
