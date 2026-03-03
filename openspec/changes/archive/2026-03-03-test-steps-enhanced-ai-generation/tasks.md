## 1. Shared Contracts And IPC Alignment

- [x] 1.1 Update `GenerateStepsInput`/output typings in `src/shared/types.ts` to represent strict AI response data as step strings.
- [x] 1.2 Update `src/shared/ipc.ts` and `src/preload/index.ts` signatures so `aiGenerateSteps` stays type-safe with the new response contract.
- [x] 1.3 Update IPC input/output tests or fixtures that currently assume `{ rawText, reason }` step rows.

## 2. AI Prompt And Response Contract Enforcement

- [x] 2.1 Replace the `AIService.generateSteps` prompt with strict instructions for JSON-only output `{ "steps": ["<step-string>"] }` and the required grammar/allowlists.
- [x] 2.2 Replace the generation response schema in `src/main/services/aiService.ts` to validate `steps` as non-empty string array payloads.
- [x] 2.3 Update fallback generation in `AIService` so fallback steps also conform to the new grammar contract.

## 3. Grammar Validation And Locator Compatibility

- [x] 3.1 Add a generation-specific validator that enforces the two canonical patterns, required quotes, and `using <LocatorKind>` suffix rules.
- [x] 3.2 Enforce allowed actions/locators, sanitize whitespace, and de-duplicate normalized step strings before returning results.
- [x] 3.3 Update parser/runtime/codegen support for locator vocabulary alignment (`testId` normalization and `xpath` support) needed by generated steps.
- [x] 3.4 Return structured failure when no valid steps remain after validation.

## 4. Renderer Consumption Updates

- [x] 4.1 Update `useTestsDomain` AI-step handling to consume string-array step output directly.
- [x] 4.2 Keep existing UX behavior for loading, non-blocking error messages, and generated step insertion into `stepsText`.

## 5. Verification

- [x] 5.1 Add/adjust `aiService` tests for strict JSON parsing, grammar enforcement, allowlist rejection, deduplication, and empty-valid-result failure.
- [x] 5.2 Add/adjust parser/codegen/run tests for `testId` and `xpath` locator compatibility in generated-step flows.
- [x] 5.3 Add/adjust IPC handler tests for success and malformed-model-output scenarios under the new contract.
- [x] 5.4 Run `npm run typecheck`, `npm run lint`, and relevant test suites; fix any regressions introduced by this change.
