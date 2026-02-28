import { describe, expect, it } from 'vitest';
import { parseStep } from '../parserService';

describe('parseStep', () => {
  it('parses explicit locator suffixes for DOM-targeting strict grammar with no warnings', () => {
    expect(parseStep('Enter "product1" in "Search" field using placeholder')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'enter',
        value: 'product1',
        target: 'Search',
        targetLocator: { kind: 'placeholder' },
      },
      warnings: [],
    });

    expect(parseStep('Click "Search" using role button')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'click',
        target: 'Search',
        targetLocator: { kind: 'role', role: 'button' },
      },
      warnings: [],
    });

    expect(parseStep('Select "United States" from "Country" dropdown using label')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'select',
        value: 'United States',
        target: 'Country',
        targetLocator: { kind: 'label' },
      },
      warnings: [],
    });

    expect(parseStep('Check "Remember me" checkbox using label')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'setChecked',
        target: 'Remember me',
        checked: true,
        targetLocator: { kind: 'label' },
      },
      warnings: [],
    });

    expect(parseStep('Hover over "Profile" using text')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'hover',
        target: 'Profile',
        targetLocator: { kind: 'text' },
      },
      warnings: [],
    });

    expect(parseStep('Press "Enter" in "Search" field using placeholder')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'press',
        key: 'Enter',
        target: 'Search',
        targetLocator: { kind: 'placeholder' },
      },
      warnings: [],
    });

    expect(parseStep('Upload file "/tmp/a.png" to "Receipt" input using testid')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'upload',
        filePaths: ['/tmp/a.png'],
        target: 'Receipt',
        targetLocator: { kind: 'testid' },
      },
      warnings: [],
    });

    expect(parseStep('Wait for download after clicking "Export" using role button')).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'download',
        triggerClickTarget: 'Export',
        triggerClickTargetLocator: { kind: 'role', role: 'button' },
      },
      warnings: [],
    });

    expect(
      parseStep(
        'Wait for request "POST **/api/login" after clicking "Login" using role button within 10s',
      ),
    ).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'waitForRequest',
        method: 'POST',
        urlPattern: '**/api/login',
        triggerClickTarget: 'Login',
        triggerClickTargetLocator: { kind: 'role', role: 'button' },
        timeoutSeconds: 10,
      },
      warnings: [],
    });
  });

  it('keeps non-element actions unchanged and warning-free', () => {
    expect(parseStep('Go to /buyer/login')).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'navigate', target: '/buyer/login' },
      warnings: [],
    });

    expect(parseStep('Expect dashboard is visible within 45s')).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'expect', assertion: 'dashboard is visible', timeoutSeconds: 45 },
      warnings: [],
    });
  });

  it('parses legacy ambiguous steps and emits suggested explicit rewrite warnings', () => {
    const strictLegacy = parseStep('Enter "hello@example.com" in "Email" field');
    expect(strictLegacy.ok).toBe(true);
    if (strictLegacy.ok) {
      expect(strictLegacy.warnings).toEqual([
        {
          code: 'ambiguous_target',
          message:
            'Target lookup is ambiguous. Add an explicit locator suffix to avoid incorrect Playwright intent.',
          suggestedStep: 'Enter "hello@example.com" in "Email" field using label',
        },
      ]);
    }

    const fallbackLegacy = parseStep('Type 123456 into OTP field');
    expect(fallbackLegacy.ok).toBe(true);
    if (fallbackLegacy.ok) {
      expect(fallbackLegacy.source).toBe('fallback');
      expect(fallbackLegacy.warnings).toHaveLength(1);
      expect(fallbackLegacy.warnings[0].code).toBe('ambiguous_target');
      expect(fallbackLegacy.warnings[0].suggestedStep).toContain('using label');
    }
  });

  it('keeps legacy explicit class/id forms parseable without warnings', () => {
    expect(parseStep("Click element with 'btn-finish' class")).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: 'btn-finish', targetLocator: { kind: 'class' } },
      warnings: [],
    });

    expect(parseStep("Click element with this ID 'elementId'")).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: 'elementId', targetLocator: { kind: 'id' } },
      warnings: [],
    });
  });

  it('returns helpful errors for invalid locator suffix tokens and role names', () => {
    expect(parseStep('Click "Search" using banana')).toEqual({
      ok: false,
      error:
        'Invalid locator in "using banana". Allowed locator kinds: label, placeholder, role <name>, text, testid, css, id, class.',
    });

    expect(parseStep('Click "Search" using role')).toEqual({
      ok: false,
      error:
        'Invalid locator in "using role". Allowed locator kinds: label, placeholder, role <name>, text, testid, css, id, class.',
    });

    expect(parseStep('Click "Search" using role bad role')).toEqual({
      ok: false,
      error:
        'Invalid locator role "bad role". Use "using role <name>" (letters, digits, hyphen).',
    });
  });

  it('returns helpful errors for invalid or empty text', () => {
    expect(parseStep('')).toEqual({ ok: false, error: 'Step cannot be empty.' });
    expect(parseStep('Do quantum shuffle now')).toEqual({
      ok: false,
      error:
        'Unable to parse step. Use Enter/Click/Go to/Expect, or advanced forms like Select dropdown, Check/Uncheck checkbox, Hover, Press key, Upload file, Dialog handling, Wait for request, or Wait for download.',
    });
  });
});
