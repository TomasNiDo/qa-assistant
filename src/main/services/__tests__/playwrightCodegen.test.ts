import { describe, expect, it } from 'vitest';
import type { ParsedAction } from '@shared/types';
import { generatePlaywrightCode, repairLegacyPlaywrightCode } from '../playwrightCodegen';

describe('generatePlaywrightCode', () => {
  it('maps ambiguous legacy actions to qa fallback helper calls', () => {
    const actions: ParsedAction[] = [
      { type: 'enter', target: 'Search Product', value: 'Kindle' },
      { type: 'click', target: 'Search' },
      { type: 'expect', assertion: 'Kindle', timeoutSeconds: 10 },
    ];

    expect(generatePlaywrightCode(actions)).toBe(
      [
        '// Ambiguous step targets use qa fallback helpers. Prefer adding `using <locator>` in steps.',
        'await qa.enter("Search Product", "Kindle");',
        'await qa.click("Search");',
        'await expect(page.getByText("Kindle").first()).toBeVisible({ timeout: 10000 });',
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

    const generated = generatePlaywrightCode(actions);
    expect(generated).toContain('await page.getByPlaceholder("Search").first().fill("wireless headphone");');
    expect(generated).toContain('await page.getByRole("button", { name: "Search" }).first().click();');
    expect(generated).toContain('page.getByRole("button", { name: "Login" }).first().click()');
    expect(generated).not.toContain('qa.click("Login")');
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

    const generated = generatePlaywrightCode(actions);
    expect(generated).toContain('page.waitForResponse');
    expect(generated).toContain('response.request().method().toUpperCase() === "POST"');
    expect(generated).toContain('response.status() === 200');
    expect(generated).toContain('{ timeout: 30000 }');
    expect(generated).toContain('qa.click("Submit")');
  });

  it('repairs known legacy expect-timeout syntax emitted by old versions', () => {
    expect(
      repairLegacyPlaywrightCode(
        'await expect(page.getByText("done").first()).toBeVisible(, { timeout: 10000 });',
      ),
    ).toBe('await expect(page.getByText("done").first()).toBeVisible({ timeout: 10000 });');
  });
});
