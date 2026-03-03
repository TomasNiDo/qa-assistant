## Context

The app already exposes `ai.generateSteps` through typed IPC and consumes generated steps in the renderer test editor. Today, `AIService.generateSteps` asks Gemini for JSON shaped as `{"steps":[{"rawText":string,"reason"?:string}]}` and then validates each `rawText` with `parseStep`.

The requested change tightens generation to a stricter contract and grammar so AI output is immediately executable with minimal cleanup. This is a cross-cutting change because it affects prompt design, response parsing, shared types, renderer consumption, and parser compatibility with locator vocabulary.

Constraints:
- Keep AI provider/model as `gemini-2.5-flash`.
- Keep local-only architecture (main-process API calls; no renderer API-key access).
- Keep step parsing strict-first with natural-language fallback.
- Preserve immediate cancellation behavior for execution flows (no run-model changes in this change).

## Goals / Non-Goals

**Goals:**
- Enforce strict AI output JSON shape: `{ "steps": string[] }`.
- Enforce two canonical grammar patterns for generated step strings.
- Enforce allowed action and locator vocabularies in generation/validation.
- Reject malformed model output and skip unsupported steps rather than returning invalid grammar.
- Keep IPC contracts, preload bridge, and renderer consumption synchronized.

**Non-Goals:**
- Rewriting the full parser grammar for all manually authored step variants.
- Changing test execution runtime semantics beyond locator support needed by the new grammar.
- Expanding into cloud/team/auth features.

## Decisions

1. **Switch generated step payload from object rows to plain strings**
- Decision: Update AI generation contract to return `{"steps":["<step>"]}` and map this directly to renderer `stepsText`.
- Rationale: Matches requested strict output and removes unnecessary intermediate fields (`reason`).
- Alternative considered: Keep `{rawText,reason}` rows and adapt later in renderer. Rejected because it weakens schema strictness and increases transformation complexity.

2. **Use dual validation: targeted grammar guard + existing parser validation**
- Decision: Add a generation-specific grammar validator (action allowlist, quoted value/target checks, required `using <locatorKind>`, pattern-1/pattern-2 compliance), then run `parseStep` as a final executable check.
- Rationale: Parser alone accepts broader legacy forms; a dedicated guard guarantees output matches the new constrained grammar without regressing existing manual authoring support.
- Alternative considered: Rely only on `parseStep`. Rejected because legacy-compatible parser behavior would allow out-of-scope formats.

3. **Normalize locator vocabulary and add missing `xpath` support**
- Decision: Accept user-facing locator token `testId` and normalize casing internally; add `xpath` as an explicit locator kind in parser/runner/codegen where needed.
- Rationale: Requested grammar requires `testId` and `xpath`, while current implementation uses `testid` and lacks explicit xpath kind.
- Alternative considered: Force prompt to emit only existing locator kinds. Rejected because it does not satisfy requested grammar contract.

4. **Handle ambiguous action list safely**
- Decision: Preserve allowlist entries in the prompt (`Navigate`, `WaitForRequest`) but generation validator permits omission when a step cannot be expressed in one of the two canonical patterns.
- Rationale: Requested rules prioritize grammar correctness over completeness (`If unsure, omit the step rather than breaking grammar`).
- Alternative considered: Invent additional grammar patterns for these actions. Rejected to keep strict scope and avoid undocumented runtime syntax changes.

5. **Deduplicate and sanitize generated lines before returning**
- Decision: Trim whitespace, remove empty lines, de-duplicate normalized step strings, and require at least one valid step; otherwise return structured generation failure.
- Rationale: Prevents duplicate/noisy output and ensures renderer receives usable results only.
- Alternative considered: Return all model lines and leave cleanup to UI. Rejected due to poor reliability and repeated manual editing.

## Risks / Trade-offs

- **[Risk] Prompt/validator mismatch causes over-filtering** -> Mitigation: add deterministic unit tests covering all allowed actions and both patterns.
- **[Risk] `xpath` support changes could affect parser/codegen behavior** -> Mitigation: add parser/codegen/run integration tests for xpath steps and keep existing locator behavior unchanged.
- **[Risk] Fewer generated steps due to stricter constraints** -> Mitigation: keep fallback generation and return actionable error message when zero valid steps remain.
- **[Risk] Contract drift across shared/preload/renderer/main** -> Mitigation: update all contracts in one change and run typecheck/tests.

## Migration Plan

1. Update shared type/IPC contracts for strict `{ steps: string[] }` generation payload.
2. Update main AI generation prompt and response schema validation in `AIService`.
3. Add grammar/allowlist validator and integrate with existing `parseStep` checks.
4. Add/normalize locator kinds required by new grammar (`testId`, `xpath`) in parser/runtime/codegen paths.
5. Update renderer consumption logic to read generated string arrays directly.
6. Add tests for prompt output contract, grammar validation, and locator compatibility.
7. Verify with `npm run typecheck`, `npm run lint`, and relevant test suites.

Rollback strategy:
- Revert shared contract and AI service prompt/validator changes to prior `{rawText,reason}` format.
- Keep parser/runtime locator additions backward-compatible where possible.

## Open Questions

- Should `Navigate` and `WaitForRequest` receive explicit grammar patterns in a follow-up, or remain optional/omittable under the two-pattern contract?
- Should AI-step generation enforce a max-step limit (for example 20) similar to planning scenario generation, or stay unconstrained for now?
