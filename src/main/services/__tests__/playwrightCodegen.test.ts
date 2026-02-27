import { describe, expect, it } from 'vitest';
import type { ParsedAction } from '@shared/types';
import { generatePlaywrightCode } from '../playwrightCodegen';

describe('generatePlaywrightCode', () => {
  it('maps common step actions to deterministic playwright code lines', () => {
    const actions: ParsedAction[] = [
      { type: 'enter', target: 'Search Product', value: 'Kindle' },
      { type: 'click', target: 'Search' },
      { type: 'expect', assertion: 'Kindle' },
    ];

    expect(generatePlaywrightCode(actions)).toBe(
      [
        'await page.getByLabel("Search Product").fill("Kindle");',
        'await page.getByRole("button", { name: "Search" }).first().click();',
        'await expect(page.getByText("Kindle").first()).toBeVisible();',
      ].join('\n'),
    );
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
    expect(generated).toContain('page.getByRole("button", { name: "Submit" }).first().click()');
  });
});
