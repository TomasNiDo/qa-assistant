## Why

The current workspace models tests directly under projects, which mixes planning and execution concerns and makes feature-level test planning hard to organize. We need a planning-first hierarchy so users can define feature intent and map planned tests before step authoring/execution work begins.

## What Changes

- Introduce a new `Feature` module under `Project` with planning fields: `title`, `acceptanceCriteria`, `requirements`, and `notes`.
- Require every test case to belong to exactly one feature.
- Introduce planning-mode test case metadata fields: `title`, `testType` (`positive` | `negative` | `edge`), `priority` (`high` | `medium` | `low`), and `isAiGenerated` (boolean).
- Scope this phase to planning only: creating and managing feature/test metadata without step authoring or execution changes.
- Update navigation and selection model from `Project -> Test Case` to `Project -> Feature -> Test Case`.
- Add migration behavior for existing data: create one default `Imported` feature per project and move existing project test cases under it.
- Enforce cascade delete from feature to its test cases.
- Explicitly defer AI prompt/context enrichment to a later phase.

## Capabilities

### New Capabilities
- `project-features-planning`: Manage project-scoped features with required acceptance criteria and planning metadata.
- `feature-test-case-planning`: Manage planning-mode test cases scoped to a feature with required planning attributes and no step authoring in this phase.

### Modified Capabilities
- None.

## Impact

- Main-process data model and migrations (`src/main/db/migrations`, services querying `test_cases`).
- IPC contracts and input schemas (`src/shared/types.ts`, `src/shared/ipc.ts`, `src/main/ipc/inputSchemas.ts`, `src/main/ipc/registerHandlers.ts`, `src/preload/index.ts`).
- Renderer domains and sidebar hierarchy (`src/renderer/src/App.tsx`, `useTestsDomain`, sidebar components).
- Seed/test utilities and mocks (`sampleSeedService`, service tests, `src/main/services/__tests__/testDb.ts`).
- Existing run/execution flow remains in place but will consume the updated hierarchy through `test_case` relationships.
