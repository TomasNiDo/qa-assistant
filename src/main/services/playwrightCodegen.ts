import type { ParsedAction, TargetLocator } from '@shared/types';

interface ResolvedLocator {
  locator: TargetLocator;
  inferred: boolean;
}

interface CodegenBlock {
  lines: string[];
  usedInferredLocator: boolean;
}

export interface GeneratePlaywrightCodeOptions {
  testTitle?: string;
  stepComments?: string[];
  wrapInTest?: boolean;
}

export function generatePlaywrightCode(
  actions: ParsedAction[],
  options: GeneratePlaywrightCodeOptions = {},
): string {
  if (actions.length === 0) {
    return '';
  }

  const blocks = actions.map((action, index) => mapActionToCode(action, index + 1));
  const bodyLines: string[] = [];
  if (blocks.some((block) => block.usedInferredLocator)) {
    bodyLines.push(
      '// Some steps were ambiguous; default locators were inferred. Add `using <locator>` for precision.',
    );
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const comment = options.stepComments?.[index]?.trim();
    if (comment) {
      if (bodyLines.length > 0) {
        bodyLines.push('');
      }
      bodyLines.push(`// ${comment}`);
    }
    bodyLines.push(...block.lines);
  }

  if (options.wrapInTest === false) {
    return repairLegacyPlaywrightCode(bodyLines.join('\n'));
  }

  const wrapped = wrapAsPlaywrightTest(bodyLines, options.testTitle ?? 'Generated Playwright Test');
  return repairLegacyPlaywrightCode(wrapped);
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

export function ensurePlaywrightTestWrapper(code: string, testTitle: string): string {
  const normalized = repairLegacyPlaywrightCode(code).trim();
  if (!normalized) {
    return '';
  }

  if (looksLikePlaywrightTestFile(normalized)) {
    return normalized;
  }

  const bodyLines = normalized.split(/\r?\n/);
  return wrapAsPlaywrightTest(bodyLines, testTitle);
}

function mapActionToCode(action: ParsedAction, order: number): CodegenBlock {
  if (action.type === 'enter') {
    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'label' });
    return {
      lines: [`await ${toLocatorExpression(action.target, resolved.locator)}.fill(${toCodeString(action.value)});`],
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'click') {
    const lines: string[] = [];
    const delayMs =
      action.delaySeconds !== undefined ? Math.max(1, Math.round(action.delaySeconds * 1000)) : undefined;
    if (delayMs) {
      lines.push(`await page.waitForTimeout(${delayMs});`);
    }

    const resolved = resolveTargetLocator(action.target, action.targetLocator, {
      kind: 'role',
      role: 'button',
    });
    lines.push(`await ${toLocatorExpression(action.target, resolved.locator)}.click();`);
    return {
      lines,
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'navigate') {
    return {
      lines: [toNavigationLine(action.target)],
      usedInferredLocator: false,
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
        usedInferredLocator: false,
      };
    }

    return {
      lines: [`await expect(page.getByText(${toCodeString(action.assertion)}).first()).toBeVisible();`],
      usedInferredLocator: false,
    };
  }

  if (action.type === 'select') {
    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'label' });
    return {
      lines: [
        `await ${toLocatorExpression(action.target, resolved.locator)}.selectOption({ label: ${toCodeString(action.value)} });`,
      ],
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'setChecked') {
    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'label' });
    return {
      lines: [
        `await ${toLocatorExpression(action.target, resolved.locator)}.${action.checked ? 'check' : 'uncheck'}();`,
      ],
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'hover') {
    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'text' });
    return {
      lines: [`await ${toLocatorExpression(action.target, resolved.locator)}.hover();`],
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'press') {
    if (!action.target) {
      return {
        lines: [`await page.keyboard.press(${toCodeString(action.key)});`],
        usedInferredLocator: false,
      };
    }

    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'label' });
    return {
      lines: [
        `await ${toLocatorExpression(action.target, resolved.locator)}.click();`,
        `await page.keyboard.press(${toCodeString(action.key)});`,
      ],
      usedInferredLocator: resolved.inferred,
    };
  }

  if (action.type === 'upload') {
    const resolved = resolveTargetLocator(action.target, action.targetLocator, { kind: 'label' });
    return {
      lines: [
        `await ${toLocatorExpression(action.target, resolved.locator)}.setInputFiles(${toCodeArray(action.filePaths)});`,
      ],
      usedInferredLocator: resolved.inferred,
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
      usedInferredLocator: false,
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
      const resolved = resolveTargetLocator(
        action.triggerClickTarget,
        action.triggerClickTargetLocator,
        { kind: 'role', role: 'button' },
      );
      return {
        lines: [
          'await Promise.all([',
          `  ${waitExpression},`,
          `  ${toLocatorExpression(action.triggerClickTarget, resolved.locator)}.click(),`,
          ']);',
        ],
        usedInferredLocator: resolved.inferred,
      };
    }

    return {
      lines: [`await ${waitExpression};`],
      usedInferredLocator: false,
    };
  }

  const timeoutOption =
    action.timeoutSeconds !== undefined
      ? `, { timeout: ${Math.max(1, Math.round(action.timeoutSeconds * 1000))} }`
      : '';
  const resolved = resolveTargetLocator(
    action.triggerClickTarget,
    action.triggerClickTargetLocator,
    { kind: 'role', role: 'button' },
  );
  return {
    lines: [
      `const download${order} = await Promise.all([`,
      `  page.waitForEvent("download"${timeoutOption}),`,
      `  ${toLocatorExpression(action.triggerClickTarget, resolved.locator)}.click(),`,
      ']);',
      `if (await download${order}[0].failure()) {`,
      '  throw new Error("Download failed.");',
      '}',
    ],
    usedInferredLocator: resolved.inferred,
  };
}

function resolveTargetLocator(
  target: string,
  explicitLocator: TargetLocator | undefined,
  fallbackLocator: TargetLocator,
): ResolvedLocator {
  if (explicitLocator) {
    return { locator: explicitLocator, inferred: false };
  }

  const trimmed = target.trim();
  if (trimmed.startsWith('#')) {
    return { locator: { kind: 'id' }, inferred: false };
  }
  if (trimmed.startsWith('.')) {
    return { locator: { kind: 'class' }, inferred: false };
  }

  return { locator: fallbackLocator, inferred: true };
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

function wrapAsPlaywrightTest(lines: string[], testTitle: string): string {
  const output: string[] = [];
  output.push("import { test, expect } from '@playwright/test';");
  output.push('');
  output.push(`test(${toCodeString(testTitle)}, async ({ page }) => {`);

  if (lines.length === 0) {
    output.push('  // No generated steps.');
  } else {
    for (const line of lines) {
      if (!line) {
        output.push('');
        continue;
      }
      output.push(`  ${line}`);
    }
  }

  output.push('});');
  return output.join('\n');
}

function looksLikePlaywrightTestFile(code: string): boolean {
  return code.includes("@playwright/test") && /\btest\s*\(/.test(code);
}
