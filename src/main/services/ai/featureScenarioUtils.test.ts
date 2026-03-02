import { describe, expect, it } from 'vitest';
import { buildFeatureScenarioPrompt } from './buildFeatureScenarioPrompt';
import { parseFeatureScenarioResponse } from './parseFeatureScenarioResponse';

describe('feature scenario AI utilities', () => {
  it('builds a strict JSON-only prompt with feature context', () => {
    const prompt = buildFeatureScenarioPrompt({
      projectName: 'Checkout',
      featureTitle: 'Promo code stacking',
      acceptanceCriteria: 'Valid stacked promos apply a combined discount.',
    });

    expect(prompt).toContain('Return JSON only');
    expect(prompt).toContain('Project: Checkout');
    expect(prompt).toContain('Feature: Promo code stacking');
    expect(prompt).toContain('Acceptance Criteria: Valid stacked promos apply a combined discount.');
  });

  it('parses, sanitizes, deduplicates, and caps generated scenarios', () => {
    const payload = {
      scenarios: [
        { title: ' Existing Draft ', type: 'positive', priority: 'high' },
        { title: 'Valid positive flow', type: 'positive', priority: 'high' },
        { title: '  Valid   positive flow ', type: 'positive', priority: 'high' },
        { title: 'Missing priority', type: 'negative' },
        { title: 'Invalid type', type: 'weird', priority: 'low' },
      ],
    };

    const parsed = parseFeatureScenarioResponse(JSON.stringify(payload), ['Existing Draft']);

    expect(parsed).toEqual({
      ok: true,
      scenarios: [
        {
          title: 'Valid positive flow',
          type: 'positive',
          priority: 'high',
        },
      ],
    });
  });

  it('returns error when scenarios array is missing', () => {
    const parsed = parseFeatureScenarioResponse('{}', []);
    expect(parsed).toEqual({
      ok: false,
      message: 'AI response must include a scenarios array.',
    });
  });

  it('returns error when model output is not valid JSON', () => {
    const parsed = parseFeatureScenarioResponse('not JSON', []);
    expect(parsed).toEqual({
      ok: false,
      message: 'AI response did not contain a JSON object.',
    });
  });
});
