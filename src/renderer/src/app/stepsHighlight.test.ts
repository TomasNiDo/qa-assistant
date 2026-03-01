import { describe, expect, it } from 'vitest';
import { highlightStepsInput } from './stepsHighlight';

describe('highlightStepsInput', () => {
  it('highlights enter action with value and target', () => {
    const output = highlightStepsInput('Enter "john@example.com" in "Email" field');
    expect(output).toContain('<span class="qa-step-token--action">Enter</span>');
    expect(output).toContain('<span class="qa-step-token--value">"john@example.com"</span>');
    expect(output).toContain('<span class="qa-step-token--target">"Email"</span>');
  });

  it('highlights click action and target', () => {
    const output = highlightStepsInput('Click "Sign in"');
    expect(output).toContain('<span class="qa-step-token--action">Click</span>');
    expect(output).toContain('<span class="qa-step-token--target">"Sign in"</span>');
  });

  it('highlights select with value and target', () => {
    const output = highlightStepsInput('Select "United States" from "Country" dropdown');
    expect(output).toContain('<span class="qa-step-token--action">Select</span>');
    expect(output).toContain('<span class="qa-step-token--value">"United States"</span>');
    expect(output).toContain('<span class="qa-step-token--target">"Country"</span>');
  });

  it('highlights press key and target', () => {
    const output = highlightStepsInput('Press "Enter" in "Search" field');
    expect(output).toContain('<span class="qa-step-token--action">Press</span>');
    expect(output).toContain('<span class="qa-step-token--value">"Enter"</span>');
    expect(output).toContain('<span class="qa-step-token--target">"Search"</span>');
  });

  it('highlights request payload and click target', () => {
    const output = highlightStepsInput('Wait for request "POST **/api/login" after clicking "Login"');
    expect(output).toContain('<span class="qa-step-token--action">Wait for request</span>');
    expect(output).toContain('<span class="qa-step-token--value">"POST **/api/login"</span>');
    expect(output).toContain('<span class="qa-step-token--target">"Login"</span>');
  });

  it('partially highlights free-form action while keeping unknown text neutral', () => {
    const output = highlightStepsInput('Tap continue button');
    expect(output).toContain('<span class="qa-step-token--action">Tap</span>');
    expect(output).not.toContain('qa-step-token--value');
    expect(output).not.toContain('qa-step-token--target');
  });

  it('keeps malformed or empty lines safe and stable', () => {
    expect(highlightStepsInput('')).toBe('');

    const output = highlightStepsInput('1. Click <script>alert(1)</script>');
    expect(output).toContain('<span class="qa-step-token--action">Click</span>');
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(output).not.toContain('<script>');
  });
});
