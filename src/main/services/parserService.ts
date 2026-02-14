import type { ParsedAction, StepParseResult } from '@shared/types';

const STRICT_ENTER = /^Enter\s+"(.+?)"\s+in\s+"(.+?)"\s+field$/i;
const STRICT_CLICK = /^Click\s+"(.+?)"(?:\s+button)?$/i;
const STRICT_CLICK_DELAYED = /^Click\s+"(.+?)"(?:\s+button)?\s+after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const STRICT_GO_TO = /^Go to\s+(.+)$/i;
const STRICT_REDIRECT_TO = /^Redirect to\s+(.+?)(?:\s+url)?$/i;
const STRICT_EXPECT = /^Expect\s+(.+)$/i;
const EXPECT_TIMEOUT_SUFFIX = /\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const EXPECT_TIMEOUT_PREFIX = /^within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;
const EXPECT_TIMEOUT_PREFIX_IN = /^in\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;
const CLICK_DELAY_SUFFIX = /\s+after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const CLICK_DELAY_PREFIX = /^after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;

export function parseStep(rawText: string): StepParseResult {
  const text = rawText.trim();
  if (!text) {
    return { ok: false, error: 'Step cannot be empty.' };
  }

  const strict = parseStrict(text);
  if (strict) {
    return { ok: true, action: strict, source: 'strict' };
  }

  const fallback = parseFallback(text);
  if (fallback) {
    return { ok: true, action: fallback, source: 'fallback' };
  }

  return {
    ok: false,
    error:
      'Unable to parse step. Use Enter "value" in "field" field, Click "text" (optionally after 1s), Go to "<path-or-url>", or Expect <assertion>.',
  };
}

function parseStrict(text: string): ParsedAction | null {
  const enterMatch = text.match(STRICT_ENTER);
  if (enterMatch) {
    return {
      type: 'enter',
      value: enterMatch[1],
      target: enterMatch[2],
    };
  }

  const clickDelayedMatch = text.match(STRICT_CLICK_DELAYED);
  if (clickDelayedMatch) {
    const delaySeconds = parseTimeoutSeconds(clickDelayedMatch[2], clickDelayedMatch[3]);
    return {
      type: 'click',
      target: normalizeClickTarget(clickDelayedMatch[1]),
      ...(delaySeconds ? { delaySeconds } : {}),
    };
  }

  const clickMatch = text.match(STRICT_CLICK);
  if (clickMatch) {
    return {
      type: 'click',
      target: normalizeClickTarget(clickMatch[1]),
    };
  }

  const goToMatch = text.match(STRICT_GO_TO);
  if (goToMatch) {
    return {
      type: 'navigate',
      target: normalizeNavigationTarget(goToMatch[1]),
    };
  }

  const redirectMatch = text.match(STRICT_REDIRECT_TO);
  if (redirectMatch) {
    return {
      type: 'navigate',
      target: normalizeNavigationTarget(redirectMatch[1]),
    };
  }

  const expectMatch = text.match(STRICT_EXPECT);
  if (expectMatch) {
    const { assertion, timeoutSeconds } = parseAssertionTimeout(expectMatch[1].trim());
    return {
      type: 'expect',
      assertion,
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
    };
  }

  return null;
}

function parseFallback(text: string): ParsedAction | null {
  const normalized = text.toLowerCase();

  if (containsAny(normalized, ['click', 'tap', 'press', 'select'])) {
    const { textWithoutDelay, delaySeconds } = parseClickDelay(text);
    const quoted = extractQuoted(textWithoutDelay);
    const target = normalizeClickTarget(quoted ?? stripLeadingVerb(textWithoutDelay));
    if (!target) {
      return null;
    }

    return {
      type: 'click',
      target,
      ...(delaySeconds ? { delaySeconds } : {}),
    };
  }

  if (containsAny(normalized, ['enter', 'type', 'fill', 'input'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      return { type: 'enter', value: quoted[0], target: quoted[1] };
    }

    const inMatch = text.match(/(?:enter|type|fill|input)\s+(.+?)\s+(?:in|into)\s+(.+)/i);
    if (inMatch) {
      return {
        type: 'enter',
        value: trimPunctuation(inMatch[1]),
        target: trimPunctuation(inMatch[2].replace(/\s+field$/i, '')),
      };
    }

    return null;
  }

  if (containsAny(normalized, ['go to', 'redirect to', 'navigate to', 'open', 'visit'])) {
    const target = normalizeNavigationTarget(
      trimPunctuation(text.replace(/^(go to|redirect to|navigate to|navigate|open|visit)\s+/i, '')),
    );
    if (!target) {
      return null;
    }

    return { type: 'navigate', target };
  }

  if (containsAny(normalized, ['expect', 'assert', 'verify', 'should', 'see'])) {
    const { assertion, timeoutSeconds } = parseAssertionTimeout(
      trimPunctuation(stripLeadingVerb(text)) || text,
    );
    return {
      type: 'expect',
      assertion,
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
    };
  }

  return null;
}

function stripLeadingVerb(text: string): string {
  return trimPunctuation(text.replace(/^(click|tap|press|select|expect|assert|verify|should|see)\s+/i, ''));
}

function extractQuoted(text: string): string | null {
  const match = text.match(/"(.+?)"/);
  return match?.[1] ?? null;
}

function extractAllQuoted(text: string): string[] {
  const result: string[] = [];
  const regex = /"(.+?)"/g;

  for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
    result.push(match[1]);
  }

  return result;
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function trimPunctuation(text: string): string {
  return text.trim().replace(/[.!]+$/, '');
}

function parseAssertionTimeout(value: string): { assertion: string; timeoutSeconds?: number } {
  const normalized = trimPunctuation(value);

  const suffixMatch = normalized.match(EXPECT_TIMEOUT_SUFFIX);
  if (suffixMatch) {
    const parsed = parseTimeoutSeconds(suffixMatch[1], suffixMatch[2]);
    const assertion = normalizeAssertion(trimPunctuation(normalized.replace(EXPECT_TIMEOUT_SUFFIX, '')));
    return parsed ? { assertion, timeoutSeconds: parsed } : { assertion };
  }

  const prefixMatch = normalized.match(EXPECT_TIMEOUT_PREFIX) ?? normalized.match(EXPECT_TIMEOUT_PREFIX_IN);
  if (prefixMatch) {
    const parsed = parseTimeoutSeconds(prefixMatch[1], prefixMatch[2]);
    const assertion = normalizeAssertion(trimPunctuation(prefixMatch[3]));
    return parsed ? { assertion, timeoutSeconds: parsed } : { assertion };
  }

  return { assertion: normalizeAssertion(normalized) };
}

function parseTimeoutSeconds(rawAmount: string, unit: string): number | null {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const seconds = unit.toLowerCase().startsWith('m') ? amount * 60 : amount;
  return Math.max(1, Math.min(600, Math.round(seconds)));
}

function normalizeAssertion(assertion: string): string {
  const withoutLocationHints = assertion
    .replace(/\binside\s+(?:a|an|the)?\s*box\b/gi, ' ')
    .replace(/\bin\s+(?:a|an|the)?\s*box\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const withoutQuotes = stripWrappingQuotes(withoutLocationHints);
  const withoutLeadingArticle = withoutQuotes.replace(/^(?:a|an|the)\s+/i, '').trim();
  return withoutLeadingArticle || withoutQuotes || withoutLocationHints || assertion.trim();
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
  ];

  if (pairs.some(([open, close]) => first === open && last === close)) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseClickDelay(value: string): { textWithoutDelay: string; delaySeconds?: number } {
  const normalized = trimPunctuation(value);
  const suffixMatch = normalized.match(CLICK_DELAY_SUFFIX);
  if (suffixMatch) {
    const parsed = parseTimeoutSeconds(suffixMatch[1], suffixMatch[2]);
    const textWithoutDelay = trimPunctuation(normalized.replace(CLICK_DELAY_SUFFIX, ''));
    return parsed ? { textWithoutDelay, delaySeconds: parsed } : { textWithoutDelay };
  }

  const prefixMatch = normalized.match(CLICK_DELAY_PREFIX);
  if (prefixMatch) {
    const parsed = parseTimeoutSeconds(prefixMatch[1], prefixMatch[2]);
    const textWithoutDelay = trimPunctuation(prefixMatch[3]);
    return parsed ? { textWithoutDelay, delaySeconds: parsed } : { textWithoutDelay };
  }

  return { textWithoutDelay: normalized };
}

function normalizeClickTarget(value: string): string {
  return stripWrappingQuotes(trimPunctuation(value));
}

function normalizeNavigationTarget(value: string): string {
  const cleaned = stripWrappingQuotes(trimPunctuation(value)).replace(/\s+url$/i, '').trim();
  return cleaned;
}
