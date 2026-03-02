## Why

Planning-mode scenario drafting is manual and slow for features with broad acceptance criteria, which reduces QA throughput and consistency. Adding AI-assisted draft generation now speeds initial test ideation while preserving mandatory human review before any approval.

## What Changes

- Add a Planning-mode action, `Generate Scenarios (AI)`, on a feature to draft scenarios from feature context.
- Add a main-process IPC workflow that builds a structured Gemini prompt from feature title, project, and acceptance criteria.
- Enforce strict JSON response parsing, validation, sanitization, deduplication, and max-result limits before persistence.
- Insert generated scenarios as drafted planning test cases with AI provenance flags (`isAiGenerated=true`, `editedByUser=false`) and no auto-approval.
- Return structured success/error payloads to renderer for loading, toast, and non-blocking error states.
- Support MVP regenerate behavior by appending new AI drafts without deleting manual drafts.

## Capabilities

### New Capabilities
- `feature-ai-scenario-generation`: Generate, validate, and persist AI-authored planning scenario drafts for a selected feature while requiring human approval before execution.

### Modified Capabilities
- `feature-test-case-planning`: Add Planning-mode UI controls and renderer behavior for triggering AI draft generation and displaying AI-generated draft indicators.

## Impact

- Renderer planning workspace actions, loading/error UI, and drafted-list visual metadata.
- Shared IPC contracts in `src/shared/ipc.ts` and `src/shared/types.ts`.
- Main-process IPC handlers and modular Gemini generation/validation utilities.
- SQLite insertion/query paths for drafted test cases and AI provenance flags.
- Test coverage for malformed AI output, deduplication rules, and regeneration behavior.
