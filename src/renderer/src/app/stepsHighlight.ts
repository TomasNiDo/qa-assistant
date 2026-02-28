type TokenKind = 'action' | 'value' | 'target';

interface TokenRange {
  kind: TokenKind;
  start: number;
  end: number;
}

interface ActionMatch {
  key: ActionKey;
  start: number;
  end: number;
}

type ActionKey =
  | 'enter'
  | 'click'
  | 'go_to'
  | 'redirect_to'
  | 'expect'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'hover_over'
  | 'press'
  | 'upload_file'
  | 'upload_files'
  | 'accept_dialog'
  | 'dismiss_dialog'
  | 'wait_for_request'
  | 'wait_for_download';

interface QuotedSegment {
  start: number;
  end: number;
}

const SEQUENCE_MARKER_PATTERN = /^\s*(?:\d+[.)]|[-*])\s+/;
const QUOTED_SEGMENT_PATTERN = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
const AFTER_CLICKING_PATTERN = /after\s+clicking/i;

const PRIMARY_ACTION_PATTERNS: Array<{ key: ActionKey; regex: RegExp }> = [
  { key: 'accept_dialog', regex: /^Accept\s+browser\s+dialog\b/i },
  { key: 'dismiss_dialog', regex: /^Dismiss\s+browser\s+dialog\b/i },
  { key: 'wait_for_request', regex: /^Wait\s+for\s+request\b/i },
  { key: 'wait_for_download', regex: /^Wait\s+for\s+download\b/i },
  { key: 'redirect_to', regex: /^Redirect\s+to\b/i },
  { key: 'hover_over', regex: /^Hover\s+over\b/i },
  { key: 'upload_files', regex: /^Upload\s+files\b/i },
  { key: 'upload_file', regex: /^Upload\s+file\b/i },
  { key: 'go_to', regex: /^Go\s+to\b/i },
  { key: 'uncheck', regex: /^Uncheck\b/i },
  { key: 'check', regex: /^Check\b/i },
  { key: 'select', regex: /^Select\b/i },
  { key: 'enter', regex: /^Enter\b/i },
  { key: 'click', regex: /^Click\b/i },
  { key: 'hover', regex: /^Hover\b/i },
  { key: 'press', regex: /^Press\b/i },
  { key: 'expect', regex: /^Expect\b/i },
];

const FALLBACK_ACTION_PATTERNS: Array<{ key: ActionKey; regex: RegExp }> = [
  { key: 'click', regex: /^Tap\b/i },
  { key: 'enter', regex: /^(?:Type|Fill|Input)\b/i },
  { key: 'go_to', regex: /^(?:Visit|Open|Navigate(?:\s+to)?)\b/i },
  { key: 'expect', regex: /^(?:Verify|Assert|Should|See)\b/i },
  { key: 'uncheck', regex: /^Untick\b/i },
  { key: 'check', regex: /^Tick\b/i },
];

export function highlightStepsInput(text: string): string {
  if (text.length === 0) {
    return '';
  }

  return text
    .split('\n')
    .map((line) => highlightStepLine(line))
    .join('\n');
}

function highlightStepLine(line: string): string {
  if (line.length === 0) {
    return '';
  }

  const actionMatch = detectActionMatch(line);
  if (!actionMatch) {
    return escapeHtml(line);
  }

  const quotedSegments = getQuotedSegments(line);
  const candidateRanges: TokenRange[] = [{ kind: 'action', start: actionMatch.start, end: actionMatch.end }];
  const mappedRanges = mapQuotedSegmentsToTokens(line, actionMatch.key, quotedSegments);
  candidateRanges.push(...mappedRanges);

  const acceptedRanges = acceptRangesByPriority(candidateRanges);
  if (acceptedRanges.length === 0) {
    return escapeHtml(line);
  }

  return applyHighlightRanges(line, acceptedRanges);
}

function detectActionMatch(line: string): ActionMatch | null {
  const markerMatch = line.match(SEQUENCE_MARKER_PATTERN);
  const offset = markerMatch ? markerMatch[0].length : 0;
  const content = line.slice(offset);

  const fromPrimary = findAction(content, offset, PRIMARY_ACTION_PATTERNS);
  if (fromPrimary) {
    return fromPrimary;
  }

  return findAction(content, offset, FALLBACK_ACTION_PATTERNS);
}

function findAction(
  content: string,
  offset: number,
  patterns: Array<{ key: ActionKey; regex: RegExp }>,
): ActionMatch | null {
  for (const pattern of patterns) {
    const match = content.match(pattern.regex);
    if (!match || typeof match.index !== 'number') {
      continue;
    }

    const start = offset + match.index;
    const end = start + match[0].length;
    return { key: pattern.key, start, end };
  }

  return null;
}

function getQuotedSegments(line: string): QuotedSegment[] {
  const ranges: QuotedSegment[] = [];
  const regex = new RegExp(QUOTED_SEGMENT_PATTERN);

  for (let match = regex.exec(line); match !== null; match = regex.exec(line)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }

  return ranges;
}

function mapQuotedSegmentsToTokens(
  line: string,
  actionKey: ActionKey,
  quotedSegments: QuotedSegment[],
): TokenRange[] {
  const ranges: TokenRange[] = [];
  const first = quotedSegments[0];
  const second = quotedSegments[1];

  switch (actionKey) {
    case 'enter':
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      if (second) {
        ranges.push({ kind: 'target', start: second.start, end: second.end });
      }
      return ranges;

    case 'select':
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      if (second) {
        ranges.push({ kind: 'target', start: second.start, end: second.end });
      }
      return ranges;

    case 'click':
    case 'hover':
    case 'hover_over':
    case 'check':
    case 'uncheck':
      if (first) {
        ranges.push({ kind: 'target', start: first.start, end: first.end });
      }
      return ranges;

    case 'press':
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      if (second) {
        ranges.push({ kind: 'target', start: second.start, end: second.end });
      }
      return ranges;

    case 'upload_file':
    case 'upload_files':
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      if (second) {
        ranges.push({ kind: 'target', start: second.start, end: second.end });
      }
      return ranges;

    case 'expect':
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      return ranges;

    case 'wait_for_request': {
      if (first) {
        ranges.push({ kind: 'value', start: first.start, end: first.end });
      }
      const targetQuote = findQuoteAfterPhrase(line, quotedSegments, AFTER_CLICKING_PATTERN);
      if (targetQuote) {
        ranges.push({ kind: 'target', start: targetQuote.start, end: targetQuote.end });
      }
      return ranges;
    }

    case 'wait_for_download': {
      const targetQuote = findQuoteAfterPhrase(line, quotedSegments, AFTER_CLICKING_PATTERN);
      if (targetQuote) {
        ranges.push({ kind: 'target', start: targetQuote.start, end: targetQuote.end });
      }
      return ranges;
    }

    case 'go_to':
    case 'redirect_to':
    case 'accept_dialog':
    case 'dismiss_dialog':
      return ranges;

    default:
      return ranges;
  }
}

function findQuoteAfterPhrase(
  line: string,
  quotedSegments: QuotedSegment[],
  phrasePattern: RegExp,
): QuotedSegment | null {
  const match = line.match(phrasePattern);
  if (!match || typeof match.index !== 'number') {
    return null;
  }

  const startAt = match.index + match[0].length;
  return quotedSegments.find((segment) => segment.start >= startAt) ?? null;
}

function acceptRangesByPriority(candidateRanges: TokenRange[]): TokenRange[] {
  const accepted: TokenRange[] = [];
  const priorities: TokenKind[] = ['action', 'value', 'target'];

  for (const kind of priorities) {
    const rangesForKind = candidateRanges.filter((range) => range.kind === kind);
    for (const range of rangesForKind) {
      if (!isValidRange(range)) {
        continue;
      }
      if (accepted.some((existing) => rangesOverlap(existing, range))) {
        continue;
      }
      accepted.push(range);
    }
  }

  return accepted.sort((left, right) => left.start - right.start);
}

function isValidRange(range: TokenRange): boolean {
  return Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end > range.start;
}

function rangesOverlap(left: TokenRange, right: TokenRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function applyHighlightRanges(line: string, ranges: TokenRange[]): string {
  let cursor = 0;
  let highlighted = '';

  for (const range of ranges) {
    if (range.start > cursor) {
      highlighted += escapeHtml(line.slice(cursor, range.start));
    }

    highlighted += `<span class="qa-step-token--${range.kind}">${escapeHtml(line.slice(range.start, range.end))}</span>`;
    cursor = range.end;
  }

  if (cursor < line.length) {
    highlighted += escapeHtml(line.slice(cursor));
  }

  return highlighted;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
