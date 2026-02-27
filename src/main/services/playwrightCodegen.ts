import type { ParsedAction } from '@shared/types';

export function generatePlaywrightCode(actions: ParsedAction[]): string {
  if (actions.length === 0) {
    return '';
  }

  return actions
    .flatMap((action, index) => mapActionToCodeLines(action, index + 1))
    .join('\n');
}

function mapActionToCodeLines(action: ParsedAction, order: number): string[] {
  if (action.type === 'enter') {
    return [`await page.getByLabel(${toCodeString(action.target)}).fill(${toCodeString(action.value)});`];
  }

  if (action.type === 'click') {
    const lines: string[] = [];
    if (action.delaySeconds) {
      lines.push(`await page.waitForTimeout(${Math.max(1, Math.round(action.delaySeconds * 1000))});`);
    }
    lines.push(`${toClickLocator(action.target)}.click();`);
    return prefixAwait(lines);
  }

  if (action.type === 'navigate') {
    return [toNavigationLine(action.target)];
  }

  if (action.type === 'expect') {
    const timeout =
      action.timeoutSeconds !== undefined
        ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
        : '';
    return [
      `await expect(page.getByText(${toCodeString(action.assertion)}).first()).toBeVisible(${timeout});`,
    ];
  }

  if (action.type === 'select') {
    return [
      `await page.getByLabel(${toCodeString(action.target)}).selectOption({ label: ${toCodeString(action.value)} });`,
    ];
  }

  if (action.type === 'setChecked') {
    return [
      `await page.getByLabel(${toCodeString(action.target)}).${
        action.checked ? 'check' : 'uncheck'
      }();`,
    ];
  }

  if (action.type === 'hover') {
    return [`await page.getByText(${toCodeString(action.target)}).first().hover();`];
  }

  if (action.type === 'press') {
    const lines: string[] = [];
    if (action.target) {
      lines.push(`await page.getByLabel(${toCodeString(action.target)}).first().click();`);
    }
    lines.push(`await page.keyboard.press(${toCodeString(action.key)});`);
    return lines;
  }

  if (action.type === 'upload') {
    return [
      `await page.getByLabel(${toCodeString(action.target)}).setInputFiles(${toCodeArray(action.filePaths)});`,
    ];
  }

  if (action.type === 'dialog') {
    const dialogAction =
      action.action === 'accept'
        ? action.promptText
          ? `dialog.accept(${toCodeString(action.promptText)})`
          : 'dialog.accept()'
        : 'dialog.dismiss()';
    return [`page.once("dialog", async (dialog) => { await ${dialogAction}; });`];
  }

  if (action.type === 'waitForRequest') {
    const requestPredicate = [
      `response.url().includes(${toCodeString(action.urlPattern)})`,
      action.method
        ? `response.request().method().toUpperCase() === ${toCodeString(action.method.toUpperCase())}`
        : null,
      action.status ? `response.status() === ${action.status}` : null,
    ]
      .filter(Boolean)
      .join(' && ');
    const timeoutOption =
      action.timeoutSeconds !== undefined
        ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
        : '';
    const waitExpression = `page.waitForResponse((response) => ${requestPredicate}${timeoutOption})`;
    if (action.triggerClickTarget) {
      return [
        `await Promise.all([`,
        `  ${waitExpression},`,
        `  ${toClickLocator(action.triggerClickTarget)}.click(),`,
        `]);`,
      ];
    }

    return [`await ${waitExpression};`];
  }

  const timeoutOption =
    action.timeoutSeconds !== undefined
      ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
      : '';
  return [
    `const download${order} = await Promise.all([`,
    `  page.waitForEvent("download"${timeoutOption}),`,
    `  ${toClickLocator(action.triggerClickTarget)}.click(),`,
    `]);`,
    `if (await download${order}[0].failure()) {`,
    `  throw new Error("Download failed.");`,
    `}`,
  ];
}

function toNavigationLine(target: string): string {
  if (/^https?:\/\//i.test(target)) {
    return `await page.goto(${toCodeString(target)});`;
  }

  if (target.startsWith('/')) {
    return `await page.goto(new URL(${toCodeString(target)}, baseUrl).toString());`;
  }

  return `await page.goto(new URL(${toCodeString(target)}, page.url() || baseUrl).toString());`;
}

function toClickLocator(target: string): string {
  if (target.startsWith('.') || target.startsWith('#')) {
    return `page.locator(${toCodeString(target)}).first()`;
  }

  return `page.getByRole("button", { name: ${toCodeString(target)} }).first()`;
}

function toCodeArray(values: string[]): string {
  return `[${values.map((value) => toCodeString(value)).join(', ')}]`;
}

function toCodeString(value: string): string {
  return JSON.stringify(value);
}

function prefixAwait(lines: string[]): string[] {
  return lines.map((line) => (line.startsWith('await ') ? line : `await ${line}`));
}
