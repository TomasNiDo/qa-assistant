import type { ParsedAction, StepParseResult } from '@shared/types';

const STRICT_ENTER = /^Enter\s+"(.+?)"\s+in\s+"(.+?)"\s+field$/i;
const STRICT_CLICK = /^Click\s+"(.+?)"(?:\s+button)?$/i;
const STRICT_CLICK_ELEMENT_WITH = /^Click\s+element\s+with\s+["'](.+?)["']$/i;
const STRICT_CLICK_ELEMENT_WITH_CLASS = /^Click\s+element\s+with\s+["'](.+?)["']\s+class$/i;
const STRICT_CLICK_ELEMENT_WITH_ID = /^Click\s+element\s+with(?:\s+this)?\s+id\s+["'](.+?)["']$/i;
const STRICT_CLICK_DELAYED = /^Click\s+"(.+?)"(?:\s+button)?\s+after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const STRICT_GO_TO = /^Go to\s+(.+)$/i;
const STRICT_REDIRECT_TO = /^Redirect to\s+(.+?)(?:\s+url)?$/i;
const STRICT_EXPECT = /^Expect\s+(.+)$/i;
const STRICT_SELECT = /^Select\s+"(.+?)"\s+from\s+"(.+?)"\s+dropdown$/i;
const STRICT_CHECK = /^Check\s+"(.+?)"\s+checkbox$/i;
const STRICT_UNCHECK = /^Uncheck\s+"(.+?)"\s+checkbox$/i;
const STRICT_HOVER = /^Hover(?:\s+over)?\s+"(.+?)"$/i;
const STRICT_PRESS = /^Press\s+"(.+?)"(?:\s+in\s+"(.+?)"\s+field)?$/i;
const STRICT_UPLOAD = /^Upload\s+files?\s+"(.+?)"\s+to\s+"(.+?)"\s+input$/i;
const STRICT_DIALOG_ACCEPT = /^Accept\s+browser\s+dialog$/i;
const STRICT_DIALOG_DISMISS = /^Dismiss\s+browser\s+dialog$/i;
const STRICT_DIALOG_PROMPT_ACCEPT = /^Enter\s+"(.+?)"\s+in\s+prompt\s+dialog\s+and\s+accept$/i;
const STRICT_WAIT_REQUEST =
  /^Wait\s+for\s+request\s+"(.+?)"(?:\s+and\s+expect\s+status\s+"?(\d{3})"?)?(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
const STRICT_WAIT_REQUEST_AFTER_CLICK =
  /^Wait\s+for\s+request\s+"(.+?)"\s+after\s+clicking\s+"(.+?)"(?:\s+and\s+expect\s+status\s+"?(\d{3})"?)?(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
const STRICT_WAIT_DOWNLOAD_AFTER_CLICK =
  /^Wait\s+for\s+download\s+after\s+clicking\s+"(.+?)"(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
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
      'Unable to parse step. Use Enter/Click/Go to/Expect, or advanced forms like Select dropdown, Check/Uncheck checkbox, Hover, Press key, Upload file, Dialog handling, Wait for request, or Wait for download.',
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

  const clickElementWithMatch = text.match(STRICT_CLICK_ELEMENT_WITH);
  if (clickElementWithMatch) {
    return {
      type: 'click',
      target: normalizeClickTarget(clickElementWithMatch[1]),
    };
  }

  const clickElementWithClassMatch = text.match(STRICT_CLICK_ELEMENT_WITH_CLASS);
  if (clickElementWithClassMatch) {
    return {
      type: 'click',
      target: `.${normalizeSelectorToken(clickElementWithClassMatch[1])}`,
    };
  }

  const clickElementWithIdMatch = text.match(STRICT_CLICK_ELEMENT_WITH_ID);
  if (clickElementWithIdMatch) {
    return {
      type: 'click',
      target: `#${normalizeSelectorToken(clickElementWithIdMatch[1])}`,
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

  const selectMatch = text.match(STRICT_SELECT);
  if (selectMatch) {
    return {
      type: 'select',
      value: selectMatch[1],
      target: selectMatch[2],
    };
  }

  const checkMatch = text.match(STRICT_CHECK);
  if (checkMatch) {
    return {
      type: 'setChecked',
      target: checkMatch[1],
      checked: true,
    };
  }

  const uncheckMatch = text.match(STRICT_UNCHECK);
  if (uncheckMatch) {
    return {
      type: 'setChecked',
      target: uncheckMatch[1],
      checked: false,
    };
  }

  const hoverMatch = text.match(STRICT_HOVER);
  if (hoverMatch) {
    return {
      type: 'hover',
      target: hoverMatch[1],
    };
  }

  const pressMatch = text.match(STRICT_PRESS);
  if (pressMatch) {
    return {
      type: 'press',
      key: pressMatch[1],
      ...(pressMatch[2] ? { target: pressMatch[2] } : {}),
    };
  }

  const uploadMatch = text.match(STRICT_UPLOAD);
  if (uploadMatch) {
    const filePaths = parseFilePaths(uploadMatch[1]);
    if (filePaths.length === 0) {
      return null;
    }

    return {
      type: 'upload',
      target: uploadMatch[2],
      filePaths,
    };
  }

  if (STRICT_DIALOG_ACCEPT.test(text)) {
    return { type: 'dialog', action: 'accept' };
  }

  if (STRICT_DIALOG_DISMISS.test(text)) {
    return { type: 'dialog', action: 'dismiss' };
  }

  const promptAcceptMatch = text.match(STRICT_DIALOG_PROMPT_ACCEPT);
  if (promptAcceptMatch) {
    return { type: 'dialog', action: 'accept', promptText: promptAcceptMatch[1] };
  }

  const requestAfterClickMatch = text.match(STRICT_WAIT_REQUEST_AFTER_CLICK);
  if (requestAfterClickMatch) {
    const timeoutSeconds = parseTimeoutSeconds(
      requestAfterClickMatch[4],
      requestAfterClickMatch[5],
    );
    const request = parseRequestSpec(requestAfterClickMatch[1]);
    if (!request) {
      return null;
    }

    return {
      type: 'waitForRequest',
      ...request,
      triggerClickTarget: requestAfterClickMatch[2],
      ...(requestAfterClickMatch[3]
        ? { status: Number(requestAfterClickMatch[3]) }
        : {}),
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
    };
  }

  const requestMatch = text.match(STRICT_WAIT_REQUEST);
  if (requestMatch) {
    const timeoutSeconds = parseTimeoutSeconds(requestMatch[3], requestMatch[4]);
    const request = parseRequestSpec(requestMatch[1]);
    if (!request) {
      return null;
    }

    return {
      type: 'waitForRequest',
      ...request,
      ...(requestMatch[2] ? { status: Number(requestMatch[2]) } : {}),
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
    };
  }

  const downloadMatch = text.match(STRICT_WAIT_DOWNLOAD_AFTER_CLICK);
  if (downloadMatch) {
    const timeoutSeconds = parseTimeoutSeconds(downloadMatch[2], downloadMatch[3]);
    return {
      type: 'download',
      triggerClickTarget: downloadMatch[1],
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
    };
  }

  return null;
}

function parseFallback(text: string): ParsedAction | null {
  const normalized = text.toLowerCase();
  const clickElementWithClassMatch = text.match(
    /(?:click|tap|press)\s+element\s+with\s+["'](.+?)["']\s+class/i,
  );
  if (clickElementWithClassMatch) {
    return {
      type: 'click',
      target: `.${normalizeSelectorToken(clickElementWithClassMatch[1])}`,
    };
  }

  const clickElementWithIdMatch = text.match(
    /(?:click|tap|press)\s+element\s+with(?:\s+this)?\s+id\s+["'](.+?)["']/i,
  );
  if (clickElementWithIdMatch) {
    return {
      type: 'click',
      target: `#${normalizeSelectorToken(clickElementWithIdMatch[1])}`,
    };
  }

  const clickElementWithMatch = text.match(
    /(?:click|tap|press)\s+element\s+with\s+["'](.+?)["']/i,
  );
  if (clickElementWithMatch) {
    return {
      type: 'click',
      target: normalizeClickTarget(clickElementWithMatch[1]),
    };
  }

  if (containsAny(normalized, ['select']) && containsAny(normalized, ['dropdown', 'option'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      return {
        type: 'select',
        value: quoted[0],
        target: quoted[1],
      };
    }
  }

  if (containsAny(normalized, ['uncheck', 'untick']) && normalized.includes('checkbox')) {
    const target = (
      extractQuoted(text) ?? trimPunctuation(text.replace(/^(uncheck|untick)\s+/i, ''))
    ).replace(/\s+checkbox$/i, '');
    return target ? { type: 'setChecked', target, checked: false } : null;
  }

  if (containsAny(normalized, ['check', 'tick']) && normalized.includes('checkbox')) {
    const target = (
      extractQuoted(text) ?? trimPunctuation(text.replace(/^(check|tick)\s+/i, ''))
    ).replace(/\s+checkbox$/i, '');
    return target ? { type: 'setChecked', target, checked: true } : null;
  }

  if (containsAny(normalized, ['hover'])) {
    const target =
      extractQuoted(text) ?? trimPunctuation(text.replace(/^(hover|hover over)\s+/i, ''));
    return target ? { type: 'hover', target } : null;
  }

  if (containsAny(normalized, ['press']) && (extractQuoted(text) || /\b(control|shift|alt|enter|tab|escape|space|arrow)/i.test(text))) {
    const quoted = extractAllQuoted(text);
    const key = (quoted[0] ?? trimPunctuation(text.replace(/^press\s+/i, '').split(/\s+in\s+/i)[0]))
      .replace(/\s+key$/i, '');
    const target = quoted[1];
    return key
      ? {
          type: 'press',
          key,
          ...(target ? { target } : {}),
        }
      : null;
  }

  if (containsAny(normalized, ['upload']) && containsAny(normalized, ['input', 'file'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      const filePaths = parseFilePaths(quoted[0]);
      if (filePaths.length > 0) {
        return {
          type: 'upload',
          filePaths,
          target: quoted[1],
        };
      }
    }
  }

  if (containsAny(normalized, ['accept dialog', 'accept browser dialog'])) {
    return { type: 'dialog', action: 'accept' };
  }

  if (containsAny(normalized, ['dismiss dialog', 'cancel dialog'])) {
    return { type: 'dialog', action: 'dismiss' };
  }

  if (containsAny(normalized, ['download']) && containsAny(normalized, ['click'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 1) {
      return {
        type: 'download',
        triggerClickTarget: quoted[quoted.length - 1],
      };
    }
  }

  if (containsAny(normalized, ['wait for request', 'request'])) {
    const requestMatch = text.match(/request\s+"(.+?)"/i);
    if (requestMatch) {
      const request = parseRequestSpec(requestMatch[1]);
      if (!request) {
        return null;
      }

      const statusMatch = text.match(/\bstatus\s+"?(\d{3})"?/i);
      const { timeoutSeconds } = parseAssertionTimeout(text);
      const clickTargetMatch = text.match(/click(?:ing)?\s+"(.+?)"/i);
      const clickTarget = clickTargetMatch?.[1];

      return {
        type: 'waitForRequest',
        ...request,
        ...(statusMatch ? { status: Number(statusMatch[1]) } : {}),
        ...(clickTarget ? { triggerClickTarget: clickTarget } : {}),
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      };
    }
  }

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
  const match = text.match(/["'](.+?)["']/);
  return match?.[1] ?? null;
}

function extractAllQuoted(text: string): string[] {
  const result: string[] = [];
  const regex = /["'](.+?)["']/g;

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
  if (!rawAmount || !unit) {
    return null;
  }

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

function normalizeSelectorToken(value: string): string {
  return stripWrappingQuotes(trimPunctuation(value)).replace(/^[.#]+/, '');
}

function normalizeNavigationTarget(value: string): string {
  const cleaned = stripWrappingQuotes(trimPunctuation(value)).replace(/\s+url$/i, '').trim();
  return cleaned;
}

function parseFilePaths(value: string): string[] {
  return value
    .split(',')
    .map((item) => stripWrappingQuotes(item.trim()))
    .filter((item) => item.length > 0);
}

function parseRequestSpec(value: string): { urlPattern: string; method?: string } | null {
  const trimmed = trimPunctuation(value);
  if (!trimmed) {
    return null;
  }

  const methodMatch = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
  if (methodMatch) {
    const urlPattern = trimPunctuation(methodMatch[2]);
    if (!urlPattern) {
      return null;
    }

    return {
      method: methodMatch[1].toUpperCase(),
      urlPattern,
    };
  }

  return { urlPattern: trimmed };
}
