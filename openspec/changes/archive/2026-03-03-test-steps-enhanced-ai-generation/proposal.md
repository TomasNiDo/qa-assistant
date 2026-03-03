## Why

AI-generated test steps are currently inconsistent in both output format and grammar, which causes parsing failures and manual cleanup before execution. Tightening generation to a single strict JSON contract and grammar set is needed now to make generated steps reliably executable in the MVP workflow.

## What Changes

- Define a strict AI step-generation output contract: `{ "steps": ["<step-string>"] }` with no markdown or non-JSON text.
- Constrain generated step text to two canonical grammar patterns and a fixed action/locator vocabulary aligned to the app’s structured parser.
- Update Gemini prompt instructions for `ai.generateSteps` to enforce grammar, valid locator kinds, and single-line step strings.
- Add response validation/sanitization that rejects malformed payloads, removes duplicates, and drops unsupported or non-parseable steps.
- Align shared IPC/type contracts and renderer consumption logic with the new string-array response shape.
- Add regression tests for grammar compliance, invalid output rejection, and stable handling of partially valid model responses.

## Capabilities

### New Capabilities
- `feature-ai-step-generation`: Generate parser-safe execution steps from test-case title and project context using a strict JSON response and constrained step grammar.

### Modified Capabilities
- None.

## Impact

- Main-process AI step generation prompting and response validation in `src/main/services/aiService.ts`.
- Potential parser/locator support adjustments in `src/main/services/parserService.ts` if grammar vocabulary requires alignment (for example `xpath` and `testId` normalization).
- Shared IPC/type definitions in `src/shared/ipc.ts` and `src/shared/types.ts` plus preload bridge synchronization.
- Renderer step generation consumption path in `src/renderer/src/app/hooks/useTestsDomain.ts`.
- Unit/integration tests under `src/main/services/__tests__/` and IPC handler coverage.
