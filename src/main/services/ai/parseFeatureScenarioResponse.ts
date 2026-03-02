import type { GeneratedFeatureScenario, TestPriority, TestType } from '@shared/types';

const ALLOWED_TYPES: ReadonlySet<TestType> = new Set(['positive', 'negative', 'edge']);
const ALLOWED_PRIORITIES: ReadonlySet<TestPriority> = new Set(['high', 'medium', 'low']);
const MAX_SCENARIOS = 20;

interface ParsedModelEnvelope {
  scenarios?: unknown;
}

interface ParsedRawScenario {
  title?: unknown;
  type?: unknown;
  priority?: unknown;
}

export type ParseFeatureScenarioResponseResult =
  | {
      ok: true;
      scenarios: GeneratedFeatureScenario[];
    }
  | {
      ok: false;
      message: string;
    };

export function parseFeatureScenarioResponse(
  rawText: string,
  existingDraftTitles: string[],
): ParseFeatureScenarioResponseResult {
  const parsedEnvelope = parseJsonEnvelope(rawText);
  if (!parsedEnvelope.ok) {
    return parsedEnvelope;
  }

  const scenarioRows = parsedEnvelope.data.scenarios;
  if (!Array.isArray(scenarioRows)) {
    return {
      ok: false,
      message: 'AI response must include a scenarios array.',
    };
  }

  const seenTitles = new Set<string>(existingDraftTitles.map(normalizeTitle));
  const accepted: GeneratedFeatureScenario[] = [];

  for (const row of scenarioRows) {
    if (!isObject(row)) {
      continue;
    }

    const candidate = row as ParsedRawScenario;
    const title = sanitizeTitle(candidate.title);
    if (!title) {
      continue;
    }

    const type = normalizeType(candidate.type);
    const priority = normalizePriority(candidate.priority);
    if (!type || !priority) {
      continue;
    }

    const normalizedTitle = normalizeTitle(title);
    if (seenTitles.has(normalizedTitle)) {
      continue;
    }

    seenTitles.add(normalizedTitle);
    accepted.push({ title, type, priority });
    if (accepted.length >= MAX_SCENARIOS) {
      break;
    }
  }

  if (accepted.length === 0) {
    return {
      ok: false,
      message: 'AI returned no valid scenarios. Try refining acceptance criteria and retry.',
    };
  }

  return {
    ok: true,
    scenarios: accepted,
  };
}

function parseJsonEnvelope(
  rawText: string,
): { ok: true; data: ParsedModelEnvelope } | { ok: false; message: string } {
  const candidate = extractJsonObjectCandidate(rawText);
  if (!candidate) {
    return {
      ok: false,
      message: 'AI response did not contain a JSON object.',
    };
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!isObject(parsed)) {
      return {
        ok: false,
        message: 'AI JSON response must be an object.',
      };
    }

    return { ok: true, data: parsed as ParsedModelEnvelope };
  } catch {
    return {
      ok: false,
      message: 'AI returned malformed JSON.',
    };
  }
}

function extractJsonObjectCandidate(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const fencedCandidate = fencedMatch?.[1]?.trim();
  if (fencedCandidate?.startsWith('{') && fencedCandidate.endsWith('}')) {
    return fencedCandidate;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  return findFirstJsonObject(trimmed);
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

function sanitizeTitle(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeType(value: unknown): TestType | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ALLOWED_TYPES.has(normalized as TestType) ? (normalized as TestType) : null;
}

function normalizePriority(value: unknown): TestPriority | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ALLOWED_PRIORITIES.has(normalized as TestPriority)
    ? (normalized as TestPriority)
    : null;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
