import { describe, expect, it } from 'vitest';
import type { ParsedAction } from '@shared/types';
import {
  ensurePlaywrightTestWrapper,
  generatePlaywrightCode,
  repairLegacyPlaywrightCode,
} from '../playwrightCodegen';

describe('generatePlaywrightCode', () => {
  it('maps ambiguous legacy actions to inferred standard Playwright locators in a full test block', () => {
    const actions: ParsedAction[] = [
      { type: 'enter', target: 'Search Product', value: 'Kindle' },
      { type: 'click', target: 'Search' },
      { type: 'expect', assertion: 'Kindle', timeoutSeconds: 10 },
    ];

    expect(
      generatePlaywrightCode(actions, {
        testTitle: 'Add item to cart',
        stepComments: [
          'Enter "Kindle" in "Search Product" field',
          'Click "Search"',
          'Expect "Kindle" within 10s',
        ],
      }),
    ).toBe(
      [
        "import { test, expect } from '@playwright/test';",
        '',
        'test("Add item to cart", async ({ page }) => {',
        '  // Some steps were ambiguous; default locators were inferred. Add `using <locator>` for precision.',
        '',
        '  // Enter "Kindle" in "Search Product" field',
        '  await page.getByLabel("Search Product").first().fill("Kindle");',
        '',
        '  // Click "Search"',
        '  await page.getByRole("button", { name: "Search" }).first().click();',
        '',
        '  // Expect "Kindle" within 10s',
        '  await expect(page.getByText("Kindle").first()).toBeVisible({ timeout: 10000 });',
        '});',
      ].join('\n'),
    );
  });

  it('uses explicit locator APIs when locator metadata is present', () => {
    const actions: ParsedAction[] = [
      {
        type: 'enter',
        target: 'Search',
        value: 'wireless headphone',
        targetLocator: { kind: 'placeholder' },
      },
      {
        type: 'click',
        target: 'Search',
        targetLocator: { kind: 'role', role: 'button' },
      },
      {
        type: 'waitForRequest',
        urlPattern: '**/api/login',
        method: 'POST',
        triggerClickTarget: 'Login',
        triggerClickTargetLocator: { kind: 'role', role: 'button' },
      },
    ];

    const generated = generatePlaywrightCode(actions, { testTitle: 'Login request waits' });
    expect(generated).toContain("import { test, expect } from '@playwright/test';");
    expect(generated).toContain('test("Login request waits", async ({ page }) => {');
    expect(generated).toContain('await page.getByPlaceholder("Search").first().fill("wireless headphone");');
    expect(generated).toContain('await page.getByRole("button", { name: "Search" }).first().click();');
    expect(generated).toContain('page.getByRole("button", { name: "Login" }).first().click()');
    expect(generated).not.toContain('qa.');
  });

  it('includes timeout and click-triggered request handling when present', () => {
    const actions: ParsedAction[] = [
      {
        type: 'waitForRequest',
        urlPattern: '**/api/login',
        method: 'POST',
        status: 200,
        triggerClickTarget: 'Submit',
        timeoutSeconds: 30,
      },
    ];

    const generated = generatePlaywrightCode(actions, { testTitle: 'Request waits' });
    expect(generated).toContain('page.waitForResponse');
    expect(generated).toContain('response.request().method().toUpperCase() === "POST"');
    expect(generated).toContain('response.status() === 200');
    expect(generated).toContain('{ timeout: 30000 }');
    expect(generated).toContain('page.getByRole("button", { name: "Submit" }).first().click()');
    expect(generated).toContain('});');
  });

  it('repairs known legacy expect-timeout syntax emitted by old versions', () => {
    expect(
      repairLegacyPlaywrightCode(
        'await expect(page.getByText("done").first()).toBeVisible(, { timeout: 10000 });',
      ),
    ).toBe('await expect(page.getByText("done").first()).toBeVisible({ timeout: 10000 });');
  });

  it('wraps legacy snippet code into a Playwright test file for default code view', () => {
    const wrapped = ensurePlaywrightTestWrapper(
      'await page.getByRole("button", { name: "Checkout" }).click();',
      'Checkout flow',
    );

    expect(wrapped).toContain("import { test, expect } from '@playwright/test';");
    expect(wrapped).toContain('test("Checkout flow", async ({ page }) => {');
    expect(wrapped).toContain('await page.getByRole("button", { name: "Checkout" }).click();');
  });
});
