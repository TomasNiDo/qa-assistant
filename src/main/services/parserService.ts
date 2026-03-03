import type {
  ParsedAction,
  StepParseResult,
  StepParseWarning,
  TargetLocator,
} from '@shared/types';

const STRICT_ENTER = /^Enter\s+"(.+?)"\s+in\s+"(.+?)"\s+field$/i;
const STRICT_CLICK = /^Click\s+"(.+?)"(?:\s+button)?$/i;
const STRICT_CLICK_ELEMENT_WITH = /^Click\s+element\s+with\s+["'](.+?)["']$/i;
const STRICT_CLICK_ELEMENT_WITH_CLASS = /^Click\s+element\s+with\s+["'](.+?)["']\s+class$/i;
const STRICT_CLICK_ELEMENT_WITH_ID = /^Click\s+element\s+with(?:\s+this)?\s+id\s+["'](.+?)["']$/i;
const STRICT_CLICK_DELAYED =
  /^Click\s+"(.+?)"(?:\s+button)?\s+after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const STRICT_GO_TO = /^Go to\s+(.+)$/i;
const STRICT_REDIRECT_TO = /^Redirect to\s+(.+?)(?:\s+url)?$/i;
const STRICT_EXPECT = /^Expect\s+(.+)$/i;
const STRICT_SELECT = /^Select\s+"(.+?)"\s+(?:from|in)\s+"(.+?)"\s+dropdown$/i;
const STRICT_CHECK = /^Check\s+"(.+?)"(?:\s+checkbox)?$/i;
const STRICT_UNCHECK = /^Uncheck\s+"(.+?)"(?:\s+checkbox)?$/i;
const STRICT_HOVER = /^Hover(?:\s+over)?\s+"(.+?)"$/i;
const STRICT_PRESS = /^Press\s+"(.+?)"(?:\s+in\s+"(.+?)"(?:\s+field)?)?$/i;
const STRICT_UPLOAD = /^Upload(?:\s+files?)?\s+"(.+?)"\s+(?:to|in)\s+"(.+?)"(?:\s+input)?$/i;
const STRICT_DIALOG_ACCEPT = /^Accept\s+browser\s+dialog$/i;
const STRICT_DIALOG_DISMISS = /^Dismiss\s+browser\s+dialog$/i;
const STRICT_DIALOG_PROMPT_ACCEPT = /^Enter\s+"(.+?)"\s+in\s+prompt\s+dialog\s+and\s+accept$/i;
const STRICT_WAIT_REQUEST =
  /^Wait\s+for\s+request\s+"(.+?)"(?:\s+and\s+expect\s+status\s+"?(\d{3})"?)?(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
const STRICT_WAIT_REQUEST_AFTER_CLICK =
  /^Wait\s+for\s+request\s+"(.+?)"\s+after\s+clicking\s+"(.+?)"(?:\s+and\s+expect\s+status\s+"?(\d{3})"?)?(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
const STRICT_WAIT_DOWNLOAD_AFTER_CLICK =
  /^Wait\s+for\s+download\s+after\s+clicking\s+"(.+?)"(?:\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes))?$/i;
const STRICT_DOWNLOAD = /^Download\s+"(.+?)"$/i;
const EXPECT_TIMEOUT_SUFFIX =
  /\s+within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const EXPECT_TIMEOUT_PREFIX =
  /^within\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;
const EXPECT_TIMEOUT_PREFIX_IN =
  /^in\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;
const CLICK_DELAY_SUFFIX =
  /\s+after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s*$/i;
const CLICK_DELAY_PREFIX =
  /^after\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\s+(.+)$/i;
const USING_SUFFIX_WITH_TIMEOUT =
  /^(.*)\s+using\s+(.+?)\s+(within\s+\d+\s*(?:s|sec|secs|second|seconds|m|min|mins|minute|minutes))\s*$/i;
const USING_SUFFIX_AT_END = /^(.*)\s+using\s+(.+?)\s*$/i;
const ROLE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const LOCATOR_KINDS_LABEL =
  'label, placeholder, role, role <name>, text, testId, css, xpath, id, class';

interface ParsedActionMatch {
  action: ParsedAction;
  ambiguousTarget: boolean;
}

interface LocatorExtractionResult {
  text: string;
  locator?: TargetLocator;
  hadUsingClause: boolean;
  error?: string;
}

export function parseStep(rawText: string): StepParseResult {
  const text = rawText.trim();
  if (!text) {
    return { ok: false, error: 'Step cannot be empty.' };
  }

  const locatorExtraction = extractLocatorSuffix(text);
  if (locatorExtraction.error) {
    return { ok: false, error: locatorExtraction.error };
  }

  const strict = parseStrict(locatorExtraction.text);
  if (strict) {
    const withLocator = applyExplicitLocatorIfPresent(
      strict.action,
      locatorExtraction.locator,
      locatorExtraction.hadUsingClause,
    );
    if (!withLocator.ok) {
      return { ok: false, error: withLocator.error };
    }

    return {
      ok: true,
      action: withLocator.action,
      source: 'strict',
      warnings:
        strict.ambiguousTarget && !withLocator.hadLocator
          ? [buildAmbiguousTargetWarning(withLocator.action)]
          : [],
    };
  }

  const fallback = parseFallback(locatorExtraction.text);
  if (fallback) {
    const withLocator = applyExplicitLocatorIfPresent(
      fallback.action,
      locatorExtraction.locator,
      locatorExtraction.hadUsingClause,
    );
    if (!withLocator.ok) {
      return { ok: false, error: withLocator.error };
    }

    return {
      ok: true,
      action: withLocator.action,
      source: 'fallback',
      warnings:
        fallback.ambiguousTarget && !withLocator.hadLocator
          ? [buildAmbiguousTargetWarning(withLocator.action)]
          : [],
    };
  }

  return {
    ok: false,
    error:
      'Unable to parse step. Use Enter/Click/Go to/Expect, or advanced forms like Select dropdown, Check/Uncheck checkbox, Hover, Press key, Upload file, Dialog handling, Wait for request, or Wait for download.',
  };
}

function parseStrict(text: string): ParsedActionMatch | null {
  const enterMatch = text.match(STRICT_ENTER);
  if (enterMatch) {
    return {
      action: {
        type: 'enter',
        value: enterMatch[1],
        target: enterMatch[2],
      },
      ambiguousTarget: true,
    };
  }

  const clickDelayedMatch = text.match(STRICT_CLICK_DELAYED);
  if (clickDelayedMatch) {
    const delaySeconds = parseTimeoutSeconds(clickDelayedMatch[2], clickDelayedMatch[3]);
    return {
      action: {
        type: 'click',
        target: normalizeClickTarget(clickDelayedMatch[1]),
        ...(delaySeconds ? { delaySeconds } : {}),
      },
      ambiguousTarget: true,
    };
  }

  const clickMatch = text.match(STRICT_CLICK);
  if (clickMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeClickTarget(clickMatch[1]),
      },
      ambiguousTarget: true,
    };
  }

  const clickElementWithMatch = text.match(STRICT_CLICK_ELEMENT_WITH);
  if (clickElementWithMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeClickTarget(clickElementWithMatch[1]),
      },
      ambiguousTarget: true,
    };
  }

  const clickElementWithClassMatch = text.match(STRICT_CLICK_ELEMENT_WITH_CLASS);
  if (clickElementWithClassMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeSelectorToken(clickElementWithClassMatch[1]),
        targetLocator: { kind: 'class' },
      },
      ambiguousTarget: false,
    };
  }

  const clickElementWithIdMatch = text.match(STRICT_CLICK_ELEMENT_WITH_ID);
  if (clickElementWithIdMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeSelectorToken(clickElementWithIdMatch[1]),
        targetLocator: { kind: 'id' },
      },
      ambiguousTarget: false,
    };
  }

  const goToMatch = text.match(STRICT_GO_TO);
  if (goToMatch) {
    return {
      action: {
        type: 'navigate',
        target: normalizeNavigationTarget(goToMatch[1]),
      },
      ambiguousTarget: false,
    };
  }

  const redirectMatch = text.match(STRICT_REDIRECT_TO);
  if (redirectMatch) {
    return {
      action: {
        type: 'navigate',
        target: normalizeNavigationTarget(redirectMatch[1]),
      },
      ambiguousTarget: false,
    };
  }

  const expectMatch = text.match(STRICT_EXPECT);
  if (expectMatch) {
    const { assertion, timeoutSeconds } = parseAssertionTimeout(expectMatch[1].trim());
    return {
      action: {
        type: 'expect',
        assertion,
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      },
      ambiguousTarget: false,
    };
  }

  const selectMatch = text.match(STRICT_SELECT);
  if (selectMatch) {
    return {
      action: {
        type: 'select',
        value: selectMatch[1],
        target: selectMatch[2],
      },
      ambiguousTarget: true,
    };
  }

  const checkMatch = text.match(STRICT_CHECK);
  if (checkMatch) {
    return {
      action: {
        type: 'setChecked',
        target: checkMatch[1],
        checked: true,
      },
      ambiguousTarget: true,
    };
  }

  const uncheckMatch = text.match(STRICT_UNCHECK);
  if (uncheckMatch) {
    return {
      action: {
        type: 'setChecked',
        target: uncheckMatch[1],
        checked: false,
      },
      ambiguousTarget: true,
    };
  }

  const hoverMatch = text.match(STRICT_HOVER);
  if (hoverMatch) {
    return {
      action: {
        type: 'hover',
        target: hoverMatch[1],
      },
      ambiguousTarget: true,
    };
  }

  const pressMatch = text.match(STRICT_PRESS);
  if (pressMatch) {
    return {
      action: {
        type: 'press',
        key: pressMatch[1],
        ...(pressMatch[2] ? { target: pressMatch[2] } : {}),
      },
      ambiguousTarget: Boolean(pressMatch[2]),
    };
  }

  const uploadMatch = text.match(STRICT_UPLOAD);
  if (uploadMatch) {
    const filePaths = parseFilePaths(uploadMatch[1]);
    if (filePaths.length === 0) {
      return null;
    }

    return {
      action: {
        type: 'upload',
        target: uploadMatch[2],
        filePaths,
      },
      ambiguousTarget: true,
    };
  }

  if (STRICT_DIALOG_ACCEPT.test(text)) {
    return {
      action: { type: 'dialog', action: 'accept' },
      ambiguousTarget: false,
    };
  }

  if (STRICT_DIALOG_DISMISS.test(text)) {
    return {
      action: { type: 'dialog', action: 'dismiss' },
      ambiguousTarget: false,
    };
  }

  const promptAcceptMatch = text.match(STRICT_DIALOG_PROMPT_ACCEPT);
  if (promptAcceptMatch) {
    return {
      action: { type: 'dialog', action: 'accept', promptText: promptAcceptMatch[1] },
      ambiguousTarget: false,
    };
  }

  const requestAfterClickMatch = text.match(STRICT_WAIT_REQUEST_AFTER_CLICK);
  if (requestAfterClickMatch) {
    const timeoutSeconds = parseTimeoutSeconds(requestAfterClickMatch[4], requestAfterClickMatch[5]);
    const request = parseRequestSpec(requestAfterClickMatch[1]);
    if (!request) {
      return null;
    }

    return {
      action: {
        type: 'waitForRequest',
        ...request,
        triggerClickTarget: requestAfterClickMatch[2],
        ...(requestAfterClickMatch[3] ? { status: Number(requestAfterClickMatch[3]) } : {}),
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      },
      ambiguousTarget: true,
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
      action: {
        type: 'waitForRequest',
        ...request,
        ...(requestMatch[2] ? { status: Number(requestMatch[2]) } : {}),
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      },
      ambiguousTarget: false,
    };
  }

  const downloadMatch = text.match(STRICT_WAIT_DOWNLOAD_AFTER_CLICK);
  if (downloadMatch) {
    const timeoutSeconds = parseTimeoutSeconds(downloadMatch[2], downloadMatch[3]);
    return {
      action: {
        type: 'download',
        triggerClickTarget: downloadMatch[1],
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      },
      ambiguousTarget: true,
    };
  }

  const directDownloadMatch = text.match(STRICT_DOWNLOAD);
  if (directDownloadMatch) {
    return {
      action: {
        type: 'download',
        triggerClickTarget: directDownloadMatch[1],
      },
      ambiguousTarget: true,
    };
  }

  return null;
}

function parseFallback(text: string): ParsedActionMatch | null {
  const normalized = text.toLowerCase();
  const clickElementWithClassMatch = text.match(
    /(?:click|tap|press)\s+element\s+with\s+["'](.+?)["']\s+class/i,
  );
  if (clickElementWithClassMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeSelectorToken(clickElementWithClassMatch[1]),
        targetLocator: { kind: 'class' },
      },
      ambiguousTarget: false,
    };
  }

  const clickElementWithIdMatch = text.match(
    /(?:click|tap|press)\s+element\s+with(?:\s+this)?\s+id\s+["'](.+?)["']/i,
  );
  if (clickElementWithIdMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeSelectorToken(clickElementWithIdMatch[1]),
        targetLocator: { kind: 'id' },
      },
      ambiguousTarget: false,
    };
  }

  const clickElementWithMatch = text.match(/(?:click|tap|press)\s+element\s+with\s+["'](.+?)["']/i);
  if (clickElementWithMatch) {
    return {
      action: {
        type: 'click',
        target: normalizeClickTarget(clickElementWithMatch[1]),
      },
      ambiguousTarget: true,
    };
  }

  if (containsAny(normalized, ['select']) && containsAny(normalized, ['dropdown', 'option'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      return {
        action: {
          type: 'select',
          value: quoted[0],
          target: quoted[1],
        },
        ambiguousTarget: true,
      };
    }
  }

  if (containsAny(normalized, ['uncheck', 'untick']) && normalized.includes('checkbox')) {
    const target = (extractQuoted(text) ?? trimPunctuation(text.replace(/^(uncheck|untick)\s+/i, '')))
      .replace(/\s+checkbox$/i, '');
    return target
      ? {
          action: { type: 'setChecked', target, checked: false },
          ambiguousTarget: true,
        }
      : null;
  }

  if (containsAny(normalized, ['check', 'tick']) && normalized.includes('checkbox')) {
    const target = (extractQuoted(text) ?? trimPunctuation(text.replace(/^(check|tick)\s+/i, '')))
      .replace(/\s+checkbox$/i, '');
    return target
      ? {
          action: { type: 'setChecked', target, checked: true },
          ambiguousTarget: true,
        }
      : null;
  }

  if (containsAny(normalized, ['hover'])) {
    const target = extractQuoted(text) ?? trimPunctuation(text.replace(/^(hover|hover over)\s+/i, ''));
    return target
      ? {
          action: { type: 'hover', target },
          ambiguousTarget: true,
        }
      : null;
  }

  if (
    containsAny(normalized, ['press']) &&
    (extractQuoted(text) || /\b(control|shift|alt|enter|tab|escape|space|arrow)/i.test(text))
  ) {
    const quoted = extractAllQuoted(text);
    const key = (quoted[0] ?? trimPunctuation(text.replace(/^press\s+/i, '').split(/\s+in\s+/i)[0])).replace(
      /\s+key$/i,
      '',
    );
    const target = quoted[1];
    return key
      ? {
          action: {
            type: 'press',
            key,
            ...(target ? { target } : {}),
          },
          ambiguousTarget: Boolean(target),
        }
      : null;
  }

  if (containsAny(normalized, ['upload']) && containsAny(normalized, ['input', 'file'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      const filePaths = parseFilePaths(quoted[0]);
      if (filePaths.length > 0) {
        return {
          action: {
            type: 'upload',
            filePaths,
            target: quoted[1],
          },
          ambiguousTarget: true,
        };
      }
    }
  }

  if (containsAny(normalized, ['accept dialog', 'accept browser dialog'])) {
    return {
      action: { type: 'dialog', action: 'accept' },
      ambiguousTarget: false,
    };
  }

  if (containsAny(normalized, ['dismiss dialog', 'cancel dialog'])) {
    return {
      action: { type: 'dialog', action: 'dismiss' },
      ambiguousTarget: false,
    };
  }

  if (containsAny(normalized, ['download']) && containsAny(normalized, ['click'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 1) {
      return {
        action: {
          type: 'download',
          triggerClickTarget: quoted[quoted.length - 1],
        },
        ambiguousTarget: true,
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
        action: {
          type: 'waitForRequest',
          ...request,
          ...(statusMatch ? { status: Number(statusMatch[1]) } : {}),
          ...(clickTarget ? { triggerClickTarget: clickTarget } : {}),
          ...(timeoutSeconds ? { timeoutSeconds } : {}),
        },
        ambiguousTarget: Boolean(clickTarget),
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
      action: {
        type: 'click',
        target,
        ...(delaySeconds ? { delaySeconds } : {}),
      },
      ambiguousTarget: true,
    };
  }

  if (containsAny(normalized, ['enter', 'type', 'fill', 'input'])) {
    const quoted = extractAllQuoted(text);
    if (quoted.length >= 2) {
      return {
        action: { type: 'enter', value: quoted[0], target: quoted[1] },
        ambiguousTarget: true,
      };
    }

    const inMatch = text.match(/(?:enter|type|fill|input)\s+(.+?)\s+(?:in|into)\s+(.+)/i);
    if (inMatch) {
      return {
        action: {
          type: 'enter',
          value: trimPunctuation(inMatch[1]),
          target: trimPunctuation(inMatch[2].replace(/\s+field$/i, '')),
        },
        ambiguousTarget: true,
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

    return {
      action: { type: 'navigate', target },
      ambiguousTarget: false,
    };
  }

  if (containsAny(normalized, ['expect', 'assert', 'verify', 'should', 'see'])) {
    const { assertion, timeoutSeconds } = parseAssertionTimeout(
      trimPunctuation(stripLeadingVerb(text)) || text,
    );
    return {
      action: {
        type: 'expect',
        assertion,
        ...(timeoutSeconds ? { timeoutSeconds } : {}),
      },
      ambiguousTarget: false,
    };
  }

  return null;
}

function extractLocatorSuffix(text: string): LocatorExtractionResult {
  const withTimeoutMatch = text.match(USING_SUFFIX_WITH_TIMEOUT);
  if (withTimeoutMatch) {
    const parsedLocator = parseLocatorToken(withTimeoutMatch[2]);
    if (!parsedLocator.ok) {
      return {
        text,
        hadUsingClause: true,
        error: parsedLocator.error,
      };
    }

    return {
      text: `${withTimeoutMatch[1].trim()} ${withTimeoutMatch[3].trim()}`.trim(),
      locator: parsedLocator.locator,
      hadUsingClause: true,
    };
  }

  const endMatch = text.match(USING_SUFFIX_AT_END);
  if (endMatch) {
    const parsedLocator = parseLocatorToken(endMatch[2]);
    if (!parsedLocator.ok) {
      return {
        text,
        hadUsingClause: true,
        error: parsedLocator.error,
      };
    }

    return {
      text: endMatch[1].trim(),
      locator: parsedLocator.locator,
      hadUsingClause: true,
    };
  }

  return {
    text,
    hadUsingClause: false,
  };
}

function parseLocatorToken(
  rawLocator: string,
): { ok: true; locator: TargetLocator } | { ok: false; error: string } {
  const normalized = rawLocator.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();
  if (!lower) {
    return {
      ok: false,
      error: `Invalid locator in "using". Allowed locator kinds: ${LOCATOR_KINDS_LABEL}.`,
    };
  }

  if (lower === 'label') {
    return { ok: true, locator: { kind: 'label' } };
  }

  if (lower === 'placeholder') {
    return { ok: true, locator: { kind: 'placeholder' } };
  }

  if (lower === 'text') {
    return { ok: true, locator: { kind: 'text' } };
  }

  if (lower === 'testid') {
    return { ok: true, locator: { kind: 'testId' } };
  }

  if (lower === 'css') {
    return { ok: true, locator: { kind: 'css' } };
  }

  if (lower === 'xpath') {
    return { ok: true, locator: { kind: 'xpath' } };
  }

  if (lower === 'id') {
    return { ok: true, locator: { kind: 'id' } };
  }

  if (lower === 'class') {
    return { ok: true, locator: { kind: 'class' } };
  }

  if (lower === 'role') {
    return {
      ok: true,
      locator: { kind: 'role', role: 'button' },
    };
  }

  if (lower.startsWith('role ')) {
    const role = lower.slice('role '.length).trim();
    if (!role || !ROLE_NAME_PATTERN.test(role)) {
      return {
        ok: false,
        error: `Invalid locator role "${role || rawLocator.trim()}". Use "using role <name>" (letters, digits, hyphen).`,
      };
    }

    return {
      ok: true,
      locator: { kind: 'role', role },
    };
  }

  return {
    ok: false,
    error: `Invalid locator in "using ${rawLocator.trim()}". Allowed locator kinds: ${LOCATOR_KINDS_LABEL}.`,
  };
}

function applyExplicitLocatorIfPresent(
  action: ParsedAction,
  locator: TargetLocator | undefined,
  hadUsingClause: boolean,
):
  | { ok: true; action: ParsedAction; hadLocator: boolean }
  | {
      ok: false;
      error: string;
    } {
  if (!locator) {
    return { ok: true, action, hadLocator: false };
  }

  if (action.type === 'enter') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'click') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'select') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'setChecked') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'hover') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'upload') {
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'press') {
    if (!action.target) {
      return {
        ok: false,
        error:
          'Locator suffix is only valid for Press steps that include a target field (for example: Press "Enter" in "Search" field using label).',
      };
    }
    return { ok: true, action: { ...action, targetLocator: locator }, hadLocator: true };
  }

  if (action.type === 'waitForRequest') {
    if (!action.triggerClickTarget) {
      return {
        ok: false,
        error: 'Locator suffix is only valid when the request wait step includes an "after clicking" target.',
      };
    }
    return {
      ok: true,
      action: { ...action, triggerClickTargetLocator: locator },
      hadLocator: true,
    };
  }

  if (action.type === 'download') {
    return {
      ok: true,
      action: { ...action, triggerClickTargetLocator: locator },
      hadLocator: true,
    };
  }

  if (hadUsingClause) {
    return {
      ok: false,
      error:
        'Locator suffix is only supported for element-targeting steps (Enter/Click/Select/Check/Hover/Press with field/Upload/Wait after clicking).',
    };
  }

  return { ok: true, action, hadLocator: false };
}

function buildAmbiguousTargetWarning(action: ParsedAction): StepParseWarning {
  const suggestedStep = buildSuggestedExplicitStep(action);
  return {
    code: 'ambiguous_target',
    message: 'Target lookup is ambiguous. Add an explicit locator suffix to avoid incorrect Playwright intent.',
    suggestedStep,
  };
}

function buildSuggestedExplicitStep(action: ParsedAction): string {
  const suggestedLocator = inferDefaultLocator(action);
  return toCanonicalStep(action, suggestedLocator);
}

function inferDefaultLocator(action: ParsedAction): TargetLocator {
  if (action.type === 'enter') {
    return { kind: 'label' };
  }

  if (action.type === 'click') {
    return { kind: 'role', role: 'button' };
  }

  if (action.type === 'select') {
    return { kind: 'label' };
  }

  if (action.type === 'setChecked') {
    return { kind: 'label' };
  }

  if (action.type === 'hover') {
    return { kind: 'text' };
  }

  if (action.type === 'press') {
    return { kind: 'label' };
  }

  if (action.type === 'upload') {
    return { kind: 'label' };
  }

  return { kind: 'role', role: 'button' };
}

function toCanonicalStep(action: ParsedAction, locator: TargetLocator): string {
  const locatorSuffix = toLocatorSuffix(locator);

  if (action.type === 'enter') {
    return `Enter "${action.value}" in "${action.target}" field using ${locatorSuffix}`;
  }

  if (action.type === 'click') {
    const delaySuffix =
      action.delaySeconds !== undefined ? ` after ${Math.max(1, Math.round(action.delaySeconds))}s` : '';
    return `Click "${action.target}" using ${locatorSuffix}${delaySuffix}`;
  }

  if (action.type === 'select') {
    return `Select "${action.value}" from "${action.target}" dropdown using ${locatorSuffix}`;
  }

  if (action.type === 'setChecked') {
    return `${action.checked ? 'Check' : 'Uncheck'} "${action.target}" checkbox using ${locatorSuffix}`;
  }

  if (action.type === 'hover') {
    return `Hover over "${action.target}" using ${locatorSuffix}`;
  }

  if (action.type === 'press') {
    if (!action.target) {
      return `Press "${action.key}"`;
    }
    return `Press "${action.key}" in "${action.target}" field using ${locatorSuffix}`;
  }

  if (action.type === 'upload') {
    const files = action.filePaths.join(',');
    const noun = action.filePaths.length > 1 ? 'files' : 'file';
    return `Upload ${noun} "${files}" to "${action.target}" input using ${locatorSuffix}`;
  }

  if (action.type === 'waitForRequest') {
    const requestSpec = action.method ? `${action.method.toUpperCase()} ${action.urlPattern}` : action.urlPattern;
    const statusSuffix = action.status ? ` and expect status "${action.status}"` : '';
    const timeoutSuffix = action.timeoutSeconds ? ` within ${action.timeoutSeconds}s` : '';
    if (action.triggerClickTarget) {
      return `Wait for request "${requestSpec}" after clicking "${action.triggerClickTarget}" using ${locatorSuffix}${statusSuffix}${timeoutSuffix}`;
    }
    return `Wait for request "${requestSpec}"${statusSuffix}${timeoutSuffix}`;
  }

  if (action.type === 'download') {
    const timeoutSuffix = action.timeoutSeconds ? ` within ${action.timeoutSeconds}s` : '';
    return `Wait for download after clicking "${action.triggerClickTarget}" using ${locatorSuffix}${timeoutSuffix}`;
  }

  if (action.type === 'navigate') {
    return `Go to ${action.target}`;
  }

  if (action.type === 'expect') {
    const timeoutSuffix = action.timeoutSeconds ? ` within ${action.timeoutSeconds}s` : '';
    return `Expect ${action.assertion}${timeoutSuffix}`;
  }

  if (action.type === 'dialog') {
    if (action.action === 'dismiss') {
      return 'Dismiss browser dialog';
    }
    if (action.promptText) {
      return `Enter "${action.promptText}" in prompt dialog and accept`;
    }
    return 'Accept browser dialog';
  }

  return '';
}

function toLocatorSuffix(locator: TargetLocator): string {
  if (locator.kind === 'role') {
    if (locator.role.toLowerCase() === 'button') {
      return 'role';
    }
    return `role ${locator.role}`;
  }

  if (locator.kind === 'testId') {
    return 'testId';
  }

  return locator.kind;
}

function stripLeadingVerb(text: string): string {
  return trimPunctuation(
    text.replace(/^(click|tap|press|select|expect|assert|verify|should|see)\s+/i, ''),
  );
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
  return stripWrappingQuotes(trimPunctuation(value)).replace(/\s+url$/i, '').trim();
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
