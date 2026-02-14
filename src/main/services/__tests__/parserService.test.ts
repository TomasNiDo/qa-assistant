import { describe, expect, it } from 'vitest';
import { parseStep } from '../parserService';

describe('parseStep', () => {
  it('parses strict grammar', () => {
    const enter = parseStep('Enter "hello@example.com" in "Email" field');
    const click = parseStep('Click "Sign in"');
    const expectStep = parseStep('Expect dashboard is visible');

    expect(enter).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'enter', value: 'hello@example.com', target: 'Email' },
    });
    expect(click).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: 'Sign in' },
    });
    expect(expectStep).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'dashboard is visible' },
    });
  });

  it('parses fallback natural language', () => {
    const click = parseStep('Tap the continue button');
    const enter = parseStep('Type 123456 into OTP field');
    const expectStep = parseStep('Verify success message appears');

    expect(click).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: 'the continue button' },
    });
    expect(enter).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'enter', value: '123456', target: 'OTP' },
    });
    expect(expectStep).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'expect', assertion: 'success message appears' },
    });
  });

  it('returns helpful errors for invalid or empty text', () => {
    expect(parseStep('')).toEqual({ ok: false, error: 'Step cannot be empty.' });
    expect(parseStep('Open browser now')).toEqual({
      ok: false,
      error:
        'Unable to parse step. Use Enter "value" in "field" field, Click "text", or Expect <assertion>.',
    });
  });
});
