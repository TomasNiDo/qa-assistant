import type { ParsedAction, StepParseResult } from '@shared/types';

const STRICT_ENTER = /^Enter\s+"(.+?)"\s+in\s+"(.+?)"\s+field$/i;
const STRICT_CLICK = /^Click\s+"(.+?)"$/i;
const STRICT_EXPECT = /^Expect\s+(.+)$/i;

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
      'Unable to parse step. Use Enter "value" in "field" field, Click "text", or Expect <assertion>.',
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

  const clickMatch = text.match(STRICT_CLICK);
  if (clickMatch) {
    return {
      type: 'click',
      target: clickMatch[1],
    };
  }

  const expectMatch = text.match(STRICT_EXPECT);
  if (expectMatch) {
    return {
      type: 'expect',
      assertion: expectMatch[1].trim(),
    };
  }

  return null;
}

function parseFallback(text: string): ParsedAction | null {
  const normalized = text.toLowerCase();

  if (containsAny(normalized, ['click', 'tap', 'press', 'select'])) {
    const quoted = extractQuoted(text);
    const target = quoted ?? stripLeadingVerb(text);
    if (!target) {
      return null;
    }

    return { type: 'click', target };
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

  if (containsAny(normalized, ['expect', 'assert', 'verify', 'should', 'see'])) {
    return {
      type: 'expect',
      assertion: trimPunctuation(stripLeadingVerb(text)) || text,
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
