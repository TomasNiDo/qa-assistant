## Context

The current feature page is planning-only and already supports drafted/approved triage. QA users cannot execute approved test cases from a dedicated phase view, and there is no compact feature-level execution summary (passed/failed/running counts plus coverage). Existing run and step data already exist in SQLite (`runs`, `steps`) and can be reused without schema changes.

Constraints:
- Keep local-only MVP scope and current Electron + React + SQLite architecture.
- Keep Planning behavior intact while adding an Execution phase entry point.
- Keep shared IPC contracts synchronized with preload/handlers when new execution summary/list queries are introduced.

## Goals / Non-Goals

**Goals:**
- Add a phase switch in feature header for both pages: `Planning` and `Execution`.
- Add a dedicated Execution page that lists approved test cases for the selected feature.
- Provide status overview cards (`Passed`, `Failed`, `Running`) plus feature coverage.
- Support execution filtering by `All`, `Passed`, `Failed`, and `Running`.
- Show per-row metadata and actions:
- title + priority/test-type tags,
- edit action to open the test-case workspace for step authoring,
- run action only when steps exist.
- Show row status indicator colors for never-run, passed, failed, and running states.

**Non-Goals:**
- Reworking drafted/approved triage rules in Planning.
- Changing run engine semantics beyond existing start/cancel behavior.
- Introducing remote sync/auth/team functionality.

## Decisions

1. **Introduce feature-phase view state instead of separate top-level route trees**
- Decision: Keep one selected feature context and add a phase state (`planning` | `execution`) that controls which feature subpage is rendered.
- Rationale: Reuses current domain hooks and keeps feature selection logic centralized.
- Alternative considered: Full router split (`/feature/:id/planning`, `/feature/:id/execution`). Rejected for now because current app already uses view-state composition and no router dependency.

2. **Back execution list with an aggregated per-test execution snapshot**
- Decision: Build an execution snapshot per approved test case combining:
- test metadata from `test_cases`,
- `hasSteps` from `steps` existence,
- latest run outcome from `runs` (most recent by `started_at`),
- running override when latest/active run is still `running`.
- Rationale: Avoids expensive per-row history fetches in renderer and gives one consistent source for filters, cards, and indicators.
- Alternative considered: Renderer computes by calling `runHistory`/`stepList` for each row. Rejected due to N+1 IPC overhead and slower list rendering.

3. **Coverage is based on executed approved cases**
- Decision: Coverage = `(approved test cases with at least one finished run) / (total approved test cases)` as a percentage; running-only and never-run cases are not counted as covered.
- Rationale: Provides a stable progress signal that matches execution completion.
- Alternative considered: Count running as covered. Rejected because it can over-report while outcomes are unresolved.

4. **Run action is conditional and respects step availability**
- Decision: Hide `Run` button when `hasSteps` is false; keep `Edit` always visible.
- Rationale: Aligns with requirement and guides users to author steps before execution.
- Alternative considered: Show disabled `Run` with tooltip. Rejected because requirement explicitly asks not to show Run when no steps exist.

5. **Edit action navigates to test-case workspace through existing selection flow**
- Decision: `Edit` selects the test case and switches to the test-case workspace screen used for step authoring.
- Rationale: Uses existing editor/run panels and minimizes new UI surface area.
- Alternative considered: Inline modal step editor from execution list. Rejected as larger UX and state-management scope.

## Risks / Trade-offs

- **[Risk] Aggregated execution snapshot can become stale after run updates** → Mitigation: refresh snapshot on run lifecycle events (`run-started`, `run-finished`) and after run-start actions.
- **[Risk] Coverage definition may differ from stakeholder expectation** → Mitigation: show clear label/help text and keep formula explicit in tests.
- **[Risk] Feature header toggle can introduce state drift between Planning and Execution** → Mitigation: source both pages from shared selected-feature state and reset only phase-local filters.
- **[Risk] Single-active-run constraint may confuse users when multiple rows show Run** → Mitigation: disable run triggers while a run is active and surface a clear message.

## Migration Plan

1. Add shared feature phase-toggle header UI and wire phase state in main app composition.
2. Build execution domain selector/query for approved test cases with execution snapshot fields.
3. Implement Execution page UI (status cards, coverage, filters, list rows with indicators/actions).
4. Wire `Edit` action to test-case workspace selection and `Run` action to existing run-start flow.
5. Add/update IPC contracts and handlers if execution snapshot endpoint is introduced.
6. Update unit/component tests for phase switching, filtering, indicator mapping, and run-button visibility.

Rollback strategy:
- Revert feature-phase toggle and execution page wiring; planning flow and data model remain intact with no irreversible migrations.

## Open Questions

- Should `cancelled` latest runs appear as gray (unexecuted style) or failed-style red in execution filters/indicators?
    - Answer: show a failed-style red
- Should coverage be shown as integer percentage only, or include numerator/denominator (for example `6/10`) beside the percentage?
    - Answer: show both
