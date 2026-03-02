## Context

The app already supports feature-level planning drafts, approval flow, execution flow, and SQLite persistence with an Electron IPC bridge. This change introduces AI-assisted draft creation in Planning mode using Gemini (`gemini-2.5-flash`) while preserving local-first architecture and human approval gates.

Key constraints:
- Gemini API key must stay in main process only.
- Renderer may trigger generation, but cannot access provider credentials.
- Generated scenarios must never bypass existing draft -> approved workflow.
- IPC/shared contracts must stay synchronized across `src/main`, `src/preload`, and `src/shared`.

## Goals / Non-Goals

**Goals:**
- Add a Planning UI action to generate draft scenarios for a selected feature.
- Add a typed IPC command to orchestrate feature lookup, prompt creation, Gemini call, strict JSON parsing, response validation, deduplication, and insertion.
- Persist generated scenarios with AI provenance flags (`isAiGenerated=true`, `editedByUser=false`) and drafted triage state.
- Return predictable success/error payloads so renderer can show loading, success toast, and non-blocking errors.
- Keep AI generation logic modular for future coverage analysis and metadata enrichment.

**Non-Goals:**
- Auto-approving or auto-promoting generated drafts to approved test cases.
- Adding cloud sync, auth, or team collaboration.
- Implementing PII masking or advanced scoring in this MVP.
- Deleting user-authored drafts during regenerate.

## Decisions

1. **Add a dedicated IPC command with structured result envelope**
- Decision: Introduce `generateFeatureScenarios(featureId)` with typed response `{ success: true, scenarios } | { success: false, message }`.
- Rationale: Gives renderer a single entry point and non-throwing UX-friendly error handling.
- Alternative considered: Throw errors over IPC and map in renderer. Rejected due to brittle message mapping and harder telemetry.

2. **Keep AI provider integration in a dedicated main-process module**
- Decision: Implement `src/main/ai/generateFeatureScenarios.ts` plus helper modules for prompt building and output validation.
- Rationale: Isolates provider concerns and keeps IPC handlers thin/testable.
- Alternative considered: Inline Gemini call in handler. Rejected because it couples transport, validation, and persistence logic.

3. **Use strict JSON contract with post-parse normalization**
- Decision: Require model output in `{ scenarios: [{ title, type, priority }] }`; parse as text -> JSON -> schema validation -> normalization.
- Rationale: Supports deterministic insertion and protects UI from malformed output.
- Alternative considered: Free-form markdown parsing. Rejected as too error-prone for production flow.

4. **Normalize and deduplicate before persistence**
- Decision: Trim titles, collapse whitespace, normalize case for duplicate checks, validate enums (`positive|negative|edge`, `high|medium|low`), and cap inserts at 20.
- Rationale: Prevents noisy duplicates and invalid records while keeping output within manageable review scope.
- Alternative considered: Insert all and rely on user cleanup. Rejected due to low trust and poor UX.

5. **Regeneration defaults to append-only in MVP**
- Decision: Repeated generation appends valid AI drafts and does not delete prior drafts.
- Rationale: Safest behavior with no risk to manual work; aligns with MVP scope.
- Alternative considered: prompt-and-replace AI-only unedited drafts. Deferred for a follow-up change.

6. **Reuse existing planning draft table with AI flags**
- Decision: Insert generated records into existing planning test case persistence path, explicitly setting `isAiGenerated=true`, `editedByUser=false`, and drafted triage status.
- Rationale: Avoids schema churn and preserves current approval flow semantics.
- Alternative considered: Separate AI drafts table. Rejected due to unnecessary complexity for MVP.

## Risks / Trade-offs

- **[Risk] LLM returns invalid or partial JSON** -> Mitigation: strict parse+validate pipeline with safe failure response and zero inserts on malformed payloads.
- **[Risk] Prompt ambiguity yields low-quality scenarios** -> Mitigation: structured prompt sections with explicit constraints (count, type mix, no steps/explanations).
- **[Risk] Duplicate scenarios across repeated runs** -> Mitigation: normalized dedupe within response and optional future cross-draft dedupe enhancement.
- **[Risk] Long model latency degrades UX** -> Mitigation: renderer loading/disabled state, timeout handling, and retry via regenerate.
- **[Risk] Contract drift across IPC/preload/shared types** -> Mitigation: single source typings in `src/shared` and typecheck in CI/dev workflow.

## Migration Plan

1. Add shared IPC channel and strict TypeScript request/response types.
2. Add main-process AI service modules (prompt builder, Gemini client, validator/sanitizer, insert orchestrator).
3. Wire IPC handler to feature lookup + AI generation + batch insert.
4. Extend preload bridge to expose typed renderer API.
5. Add Planning-mode UI button, loading state, toast/error behavior, and AI badge rendering for generated drafts.
6. Add tests for validation edge cases, IPC happy/error paths, and renderer state transitions.

Rollback strategy:
- Remove new IPC channel wiring and planning UI trigger; existing manual draft and approval flows remain unaffected.

## Open Questions

- Should regenerate later support selective replacement of prior AI drafts that were never edited?
    - Answer: yes
- Should duplicate checks in MVP compare only within current AI response or also against existing drafted titles in DB?
    - Answer: Against the existing drafted titles as well
