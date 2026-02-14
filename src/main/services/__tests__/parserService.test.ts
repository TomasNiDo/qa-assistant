import { describe, expect, it } from 'vitest';
import { parseStep } from '../parserService';

describe('parseStep', () => {
  it('parses strict grammar', () => {
    const enter = parseStep('Enter "hello@example.com" in "Email" field');
    const click = parseStep('Click "Sign in"');
    const clickDelayed = parseStep('Click "Sign in" button after 1 sec');
    const goToPath = parseStep('Go to /buyer/login');
    const redirectToPath = parseStep('Redirect to /signup url');
    const expectStep = parseStep('Expect dashboard is visible');
    const expectWithTimeout = parseStep('Expect dashboard is visible within 45s');
    const expectInsideBox = parseStep('Expect a Menu inside a box within 30s');
    const expectQuoted = parseStep('Expect "Menu" within 60s');

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
    expect(clickDelayed).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: 'Sign in', delaySeconds: 1 },
    });
    expect(goToPath).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'navigate', target: '/buyer/login' },
    });
    expect(redirectToPath).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'navigate', target: '/signup' },
    });
    expect(expectStep).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'dashboard is visible' },
    });
    expect(expectWithTimeout).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'dashboard is visible', timeoutSeconds: 45 },
    });
    expect(expectInsideBox).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'Menu', timeoutSeconds: 30 },
    });
    expect(expectQuoted).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'Menu', timeoutSeconds: 60 },
    });
  });

  it('parses fallback natural language', () => {
    const click = parseStep('Tap the continue button');
    const clickAfterDelay = parseStep('Click Generate Masterpiece button after 1 sec');
    const navigateNatural = parseStep('Visit /orders');
    const enter = parseStep('Type 123456 into OTP field');
    const expectStep = parseStep('Verify success message appears');
    const expectWithTimeout = parseStep('Verify success message appears within 2 minutes');
    const expectWithPrefixTimeout = parseStep(
      'Expect within 60 seconds the generated dish name inside a box',
    );

    expect(click).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: 'the continue button' },
    });
    expect(clickAfterDelay).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: 'Generate Masterpiece button', delaySeconds: 1 },
    });
    expect(navigateNatural).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'navigate', target: '/orders' },
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
    expect(expectWithTimeout).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'expect', assertion: 'success message appears', timeoutSeconds: 120 },
    });
    expect(expectWithPrefixTimeout).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'expect',
        assertion: 'generated dish name',
        timeoutSeconds: 60,
      },
    });
  });

  it('returns helpful errors for invalid or empty text', () => {
    expect(parseStep('')).toEqual({ ok: false, error: 'Step cannot be empty.' });
    expect(parseStep('Do quantum shuffle now')).toEqual({
      ok: false,
      error:
        'Unable to parse step. Use Enter "value" in "field" field, Click "text" (optionally after 1s), Go to "<path-or-url>", or Expect <assertion>.',
    });
  });
});
