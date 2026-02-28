import type { ParsedAction, TargetLocator } from '@shared/types';

interface CodegenBlock {
  lines: string[];
  usesQaFallback: boolean;
}

export function generatePlaywrightCode(actions: ParsedAction[]): string {
  if (actions.length === 0) {
    return '';
  }

  const mapped = actions.map((action, index) => mapActionToCode(action, index + 1));
  const lines: string[] = [];
  if (mapped.some((item) => item.usesQaFallback)) {
    lines.push('// Ambiguous step targets use qa fallback helpers. Prefer adding `using <locator>` in steps.');
  }
  for (const item of mapped) {
    lines.push(...item.lines);
  }

  return repairLegacyPlaywrightCode(lines.join('\n'));
}

export function repairLegacyPlaywrightCode(code: string): string {
  if (!code) {
    return code;
  }

  return code.replace(
    /\.toBeVisible\(\s*,\s*\{\s*timeout:\s*(\d+)\s*\}\s*\)/g,
    '.toBeVisible({ timeout: $1 })',
  );
}

function mapActionToCode(action: ParsedAction, order: number): CodegenBlock {
  if (action.type === 'enter') {
    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [`await ${toLocatorExpression(action.target, locator)}.fill(${toCodeString(action.value)});`],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.enter(${toCodeString(action.target)}, ${toCodeString(action.value)});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'click') {
    const lines: string[] = [];
    const delayMs =
      action.delaySeconds !== undefined ? Math.max(1, Math.round(action.delaySeconds * 1000)) : undefined;
    if (delayMs) {
      lines.push(`await page.waitForTimeout(${delayMs});`);
    }

    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      lines.push(`await ${toLocatorExpression(action.target, locator)}.click();`);
      return { lines, usesQaFallback: false };
    }

    lines.push(`await qa.click(${toCodeString(action.target)});`);
    return { lines, usesQaFallback: true };
  }

  if (action.type === 'navigate') {
    return {
      lines: [toNavigationLine(action.target)],
      usesQaFallback: false,
    };
  }

  if (action.type === 'expect') {
    if (action.timeoutSeconds !== undefined) {
      return {
        lines: [
          `await expect(page.getByText(${toCodeString(action.assertion)}).first()).toBeVisible({ timeout: ${Math.max(
            1,
            Math.round(action.timeoutSeconds * 1000),
          )} });`,
        ],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await expect(page.getByText(${toCodeString(action.assertion)}).first()).toBeVisible();`],
      usesQaFallback: false,
    };
  }

  if (action.type === 'select') {
    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [
          `await ${toLocatorExpression(action.target, locator)}.selectOption({ label: ${toCodeString(action.value)} });`,
        ],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.select(${toCodeString(action.target)}, ${toCodeString(action.value)});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'setChecked') {
    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [
          `await ${toLocatorExpression(action.target, locator)}.${action.checked ? 'check' : 'uncheck'}();`,
        ],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.setChecked(${toCodeString(action.target)}, ${action.checked ? 'true' : 'false'});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'hover') {
    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [`await ${toLocatorExpression(action.target, locator)}.hover();`],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.hover(${toCodeString(action.target)});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'press') {
    if (!action.target) {
      return {
        lines: [`await page.keyboard.press(${toCodeString(action.key)});`],
        usesQaFallback: false,
      };
    }

    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [
          `await ${toLocatorExpression(action.target, locator)}.click();`,
          `await page.keyboard.press(${toCodeString(action.key)});`,
        ],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.press(${toCodeString(action.key)}, ${toCodeString(action.target)});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'upload') {
    const locator = resolveTargetLocator(action.target, action.targetLocator);
    if (locator) {
      return {
        lines: [
          `await ${toLocatorExpression(action.target, locator)}.setInputFiles(${toCodeArray(action.filePaths)});`,
        ],
        usesQaFallback: false,
      };
    }

    return {
      lines: [`await qa.upload(${toCodeString(action.target)}, ${toCodeArray(action.filePaths)});`],
      usesQaFallback: true,
    };
  }

  if (action.type === 'dialog') {
    const dialogAction =
      action.action === 'accept'
        ? action.promptText
          ? `dialog.accept(${toCodeString(action.promptText)})`
          : 'dialog.accept()'
        : 'dialog.dismiss()';
    return {
      lines: [`page.once("dialog", async (dialog) => { await ${dialogAction}; });`],
      usesQaFallback: false,
    };
  }

  if (action.type === 'waitForRequest') {
    const requestPredicate = [
      `response.url().includes(${toCodeString(action.urlPattern)})`,
      action.method
        ? `response.request().method().toUpperCase() === ${toCodeString(action.method.toUpperCase())}`
        : null,
      action.status !== undefined ? `response.status() === ${action.status}` : null,
    ]
      .filter(Boolean)
      .join(' && ');
    const timeoutOption =
      action.timeoutSeconds !== undefined
        ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
        : '';
    const waitExpression = `page.waitForResponse((response) => ${requestPredicate}${timeoutOption})`;
    if (action.triggerClickTarget) {
      const clickLocator = resolveTargetLocator(
        action.triggerClickTarget,
        action.triggerClickTargetLocator,
      );
      return {
        lines: [
          'await Promise.all([',
          `  ${waitExpression},`,
          clickLocator
            ? `  ${toLocatorExpression(action.triggerClickTarget, clickLocator)}.click(),`
            : `  qa.click(${toCodeString(action.triggerClickTarget)}),`,
          ']);',
        ],
        usesQaFallback: !clickLocator,
      };
    }

    return {
      lines: [`await ${waitExpression};`],
      usesQaFallback: false,
    };
  }

  const timeoutOption =
    action.timeoutSeconds !== undefined
      ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
      : '';
  const clickLocator = resolveTargetLocator(
    action.triggerClickTarget,
    action.triggerClickTargetLocator,
  );
  return {
    lines: [
      `const download${order} = await Promise.all([`,
      `  page.waitForEvent("download"${timeoutOption}),`,
      clickLocator
        ? `  ${toLocatorExpression(action.triggerClickTarget, clickLocator)}.click(),`
        : `  qa.click(${toCodeString(action.triggerClickTarget)}),`,
      ']);',
      `if (await download${order}[0].failure()) {`,
      '  throw new Error("Download failed.");',
      '}',
    ],
    usesQaFallback: !clickLocator,
  };
}

function resolveTargetLocator(target: string, locator?: TargetLocator): TargetLocator | undefined {
  if (locator) {
    return locator;
  }

  const trimmed = target.trim();
  if (trimmed.startsWith('#')) {
    return { kind: 'id' };
  }
  if (trimmed.startsWith('.')) {
    return { kind: 'class' };
  }
  return undefined;
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

function toLocatorExpression(target: string, locator: TargetLocator): string {
  if (locator.kind === 'label') {
    return `page.getByLabel(${toCodeString(target)}).first()`;
  }

  if (locator.kind === 'placeholder') {
    return `page.getByPlaceholder(${toCodeString(target)}).first()`;
  }

  if (locator.kind === 'role') {
    return `page.getByRole(${toCodeString(locator.role)}, { name: ${toCodeString(target)} }).first()`;
  }

  if (locator.kind === 'text') {
    return `page.getByText(${toCodeString(target)}).first()`;
  }

  if (locator.kind === 'testid') {
    return `page.getByTestId(${toCodeString(target)}).first()`;
  }

  if (locator.kind === 'css') {
    return `page.locator(${toCodeString(target)}).first()`;
  }

  if (locator.kind === 'id') {
    const idValue = stripSelectorPrefix(target, '#');
    return `page.locator(${toCodeString(`[id="${escapeAttributeValue(idValue)}"]`)}).first()`;
  }

  const classValue = stripSelectorPrefix(target, '.');
  return `page.locator(${toCodeString(`[class~="${escapeAttributeValue(classValue)}"]`)}).first()`;
}

function stripSelectorPrefix(value: string, prefix: '#' | '.'): string {
  const trimmed = value.trim();
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(1).trim();
  }
  return trimmed;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toCodeArray(values: string[]): string {
  return `[${values.map((value) => toCodeString(value)).join(', ')}]`;
}

function toCodeString(value: string): string {
  return JSON.stringify(value);
}
