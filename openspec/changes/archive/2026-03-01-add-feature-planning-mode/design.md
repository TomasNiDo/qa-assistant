## Context

The current system stores test cases directly under projects and assumes executable test-case content (steps + generated/custom code) across services, IPC validation, and renderer flows. This change introduces a planning-first hierarchy where users organize work by feature before execution details are authored.

The planning phase must support:
- Feature creation and maintenance with acceptance criteria as the primary field.
- Planning-mode test cases under features with metadata only.
- Backward-safe migration of existing project-level test cases into the new hierarchy.

Constraints from current codebase:
- SQLite-first local data model and migrations.
- Strongly typed shared contracts between main/preload/renderer.
- Existing run and execution flows should remain available but are not expanded in this phase.

## Goals / Non-Goals

**Goals:**
- Introduce `Project -> Feature -> Test Case` hierarchy.
- Enforce exactly-one-feature ownership per test case.
- Add feature planning fields (`title`, `acceptanceCriteria`, `requirements`, `notes`).
- Add planning test metadata (`testType`, `priority`, `isAiGenerated`).
- Deliver data migration that auto-creates `Imported` feature per project and rehomes existing test cases.
- Keep feature-title uniqueness unrestricted within a project.
- Ensure deleting a feature cascades to its test cases.

**Non-Goals:**
- AI prompt/context enrichment using feature fields (deferred).
- Step authoring or execution-flow redesign in this phase.
- Additional workflow phases beyond introducing planning-mode data structures and UI.

## Decisions

### 1) Introduce first-class `features` table and reference it from test cases
- Decision: Add `features` table keyed by project; add required `feature_id` on test-case records.
- Rationale: Matches intended hierarchy and enforces ownership at the database level.
- Alternatives considered:
  - Keep only `project_id` and store feature metadata on test case: rejected because it does not create a reusable feature module.
  - Keep both `project_id` + `feature_id` permanently: acceptable for transitional migration but avoided as long-term source-of-truth duplication.

### 2) Planning metadata is first-class for test cases
- Decision: Extend test-case model with planning attributes: `test_type`, `priority`, `is_ai_generated`.
- Rationale: Planning needs must be queryable/filterable and not embedded in unstructured notes.
- Alternatives considered:
  - Store metadata as JSON blob: rejected due to weaker validation and contract clarity.

### 3) Feature acceptance criteria is required; requirements is optional text
- Decision: Enforce required `acceptance_criteria`; keep `requirements` optional text; `notes` optional.
- Rationale: Mirrors product priority and keeps planning capture lightweight.
- Alternatives considered:
  - Make requirements required: rejected by scope decision.
  - Structured requirements list in this phase: deferred for later iteration.

### 4) Migration strategy: auto-create `Imported` feature per project
- Decision: During migration, create one `Imported` feature for each existing project and reassign existing test cases.
- Rationale: Prevents data loss and enables immediate compatibility with required feature ownership.
- Alternatives considered:
  - Block startup until user manually maps legacy tests: rejected due to poor upgrade UX.
  - Create one feature per legacy test case: rejected as noisy and low-value.

### 5) Feature delete cascades by foreign-key policy
- Decision: Feature deletion cascades to dependent test cases and their downstream rows.
- Rationale: Matches expected ownership semantics and explicit user decision.
- Alternatives considered:
  - Soft-delete or orphan strategy: rejected for MVP complexity and ambiguity.

### 6) Planning mode excludes step authoring constraints in create/edit flow
- Decision: Planning-mode CRUD must not require steps when creating/updating planned test cases.
- Rationale: Current step/code requirements are execution concerns and block planning-first UX.
- Alternatives considered:
  - Force placeholder steps for planning records: rejected as polluting execution artifacts.
  - Build separate planned-test table: possible, but rejected for now to avoid duplicate test entities and conversion complexity.

## Risks / Trade-offs

- [Risk] Existing execution services assume steps/code fields are always present. -> Mitigation: gate execution actions on run-readiness and preserve explicit validation in run-start path.
- [Risk] Migration mistakes could orphan test data. -> Mitigation: transactional migration with FK constraints and pre/post row-count assertions.
- [Risk] Broad contract ripple across IPC and renderer state. -> Mitigation: update shared types first, then compile-driven refactor across preload/handlers/hooks/components.
- [Risk] Test doubles (`testDb`) rely on SQL string matching and may break with query changes. -> Mitigation: update fake DB patterns alongside service-query edits and add regression tests around migration + hierarchy queries.

## Migration Plan

1. Add schema migration for `features` and new test-case planning fields.
2. Backfill per project:
   - Create one `Imported` feature row.
   - Assign all existing project test cases to that feature.
3. Enforce not-null/foreign-key constraints for feature ownership.
4. Update service queries and IPC contracts to operate on feature-scoped test-case flows.
5. Update renderer selection and sidebar hierarchy.
6. Verify with integration tests and startup smoke checks.

Rollback strategy:
- If migration fails, transaction rollback leaves DB untouched.
- If deployment regression occurs post-migration, restore from local DB backup taken prior to applying schema upgrade.

## Open Questions

- Should run-launch UI in this phase hide planned tests that lack steps, or show them with a clear “planning only” status?
- Should `Imported` feature names be localized/customizable, or fixed as internal default text for MVP?
