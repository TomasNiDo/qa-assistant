import { describe, expect, it } from 'vitest';
import { parseStep } from '../parserService';

describe('parseStep', () => {
  it('parses strict grammar', () => {
    const enter = parseStep('Enter "hello@example.com" in "Email" field');
    const click = parseStep('Click "Sign in"');
    const clickElementWithIdentifier = parseStep("Click element with 'btn-finish'");
    const clickElementWithClass = parseStep("Click element with 'btn-finish' class");
    const clickElementWithId = parseStep("Click element with this ID 'elementId'");
    const clickDelayed = parseStep('Click "Sign in" button after 1 sec');
    const goToPath = parseStep('Go to /buyer/login');
    const redirectToPath = parseStep('Redirect to /signup url');
    const expectStep = parseStep('Expect dashboard is visible');
    const expectWithTimeout = parseStep('Expect dashboard is visible within 45s');
    const expectInsideBox = parseStep('Expect a Menu inside a box within 30s');
    const expectQuoted = parseStep('Expect "Menu" within 60s');
    const select = parseStep('Select "United States" from "Country" dropdown');
    const check = parseStep('Check "I agree to Terms" checkbox');
    const uncheck = parseStep('Uncheck "Subscribe to newsletter" checkbox');
    const hover = parseStep('Hover over "Profile"');
    const press = parseStep('Press "Control+K"');
    const pressInField = parseStep('Press "Enter" in "Search" field');
    const uploadSingle = parseStep('Upload file "fixtures/invoice.pdf" to "Receipt" input');
    const uploadMany = parseStep('Upload files "a.png,b.png" to "Attachments" input');
    const dialogAccept = parseStep('Accept browser dialog');
    const dialogDismiss = parseStep('Dismiss browser dialog');
    const dialogPromptAccept = parseStep('Enter "CONFIRM" in prompt dialog and accept');
    const requestWait = parseStep('Wait for request "POST **/api/login" and expect status "200"');
    const requestWaitAfterClick = parseStep(
      'Wait for request "**/api/profile" after clicking "Load profile" within 10s',
    );
    const waitForDownload = parseStep('Wait for download after clicking "Export CSV" within 15s');

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
    expect(clickElementWithIdentifier).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: 'btn-finish' },
    });
    expect(clickElementWithClass).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: '.btn-finish' },
    });
    expect(clickElementWithId).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'click', target: '#elementId' },
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
    expect(select).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'select', value: 'United States', target: 'Country' },
    });
    expect(check).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'setChecked', target: 'I agree to Terms', checked: true },
    });
    expect(uncheck).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'setChecked', target: 'Subscribe to newsletter', checked: false },
    });
    expect(hover).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'hover', target: 'Profile' },
    });
    expect(press).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'press', key: 'Control+K' },
    });
    expect(pressInField).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'press', key: 'Enter', target: 'Search' },
    });
    expect(uploadSingle).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'upload', filePaths: ['fixtures/invoice.pdf'], target: 'Receipt' },
    });
    expect(uploadMany).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'upload', filePaths: ['a.png', 'b.png'], target: 'Attachments' },
    });
    expect(dialogAccept).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'dialog', action: 'accept' },
    });
    expect(dialogDismiss).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'dialog', action: 'dismiss' },
    });
    expect(dialogPromptAccept).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'dialog', action: 'accept', promptText: 'CONFIRM' },
    });
    expect(requestWait).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'waitForRequest',
        method: 'POST',
        urlPattern: '**/api/login',
        status: 200,
      },
    });
    expect(requestWaitAfterClick).toEqual({
      ok: true,
      source: 'strict',
      action: {
        type: 'waitForRequest',
        urlPattern: '**/api/profile',
        triggerClickTarget: 'Load profile',
        timeoutSeconds: 10,
      },
    });
    expect(waitForDownload).toEqual({
      ok: true,
      source: 'strict',
      action: { type: 'download', triggerClickTarget: 'Export CSV', timeoutSeconds: 15 },
    });
  });

  it('parses fallback natural language', () => {
    const click = parseStep('Tap the continue button');
    const clickElementWithIdentifier = parseStep("Tap element with 'btn-finish'");
    const clickElementWithClass = parseStep("Tap element with 'btn-finish' class");
    const clickElementWithId = parseStep("Tap element with this id 'elementId'");
    const clickAfterDelay = parseStep('Click Generate Masterpiece button after 1 sec');
    const navigateNatural = parseStep('Visit /orders');
    const enter = parseStep('Type 123456 into OTP field');
    const expectStep = parseStep('Verify success message appears');
    const expectWithTimeout = parseStep('Verify success message appears within 2 minutes');
    const expectWithPrefixTimeout = parseStep(
      'Expect within 60 seconds the generated dish name inside a box',
    );
    const select = parseStep('Please select "Business" option in "Plan type" dropdown');
    const check = parseStep('Tick Remember me checkbox');
    const hover = parseStep('Hover Account menu');
    const press = parseStep('Press Escape key');
    const upload = parseStep('Upload "fixtures/avatar.png" to "Avatar" input');
    const dismissDialog = parseStep('Dismiss dialog');
    const requestWait = parseStep(
      'When I click "Refresh profile", wait for request "GET **/api/me"',
    );
    const download = parseStep('After clicking "Export CSV", wait for the download');

    expect(click).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: 'the continue button' },
    });
    expect(clickElementWithIdentifier).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: 'btn-finish' },
    });
    expect(clickElementWithClass).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: '.btn-finish' },
    });
    expect(clickElementWithId).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'click', target: '#elementId' },
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
    expect(select).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'select', value: 'Business', target: 'Plan type' },
    });
    expect(check).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'setChecked', target: 'Remember me', checked: true },
    });
    expect(hover).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'hover', target: 'Account menu' },
    });
    expect(press).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'press', key: 'Escape' },
    });
    expect(upload).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'upload', filePaths: ['fixtures/avatar.png'], target: 'Avatar' },
    });
    expect(dismissDialog).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'dialog', action: 'dismiss' },
    });
    expect(requestWait).toEqual({
      ok: true,
      source: 'fallback',
      action: {
        type: 'waitForRequest',
        method: 'GET',
        urlPattern: '**/api/me',
        triggerClickTarget: 'Refresh profile',
      },
    });
    expect(download).toEqual({
      ok: true,
      source: 'fallback',
      action: { type: 'download', triggerClickTarget: 'Export CSV' },
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
