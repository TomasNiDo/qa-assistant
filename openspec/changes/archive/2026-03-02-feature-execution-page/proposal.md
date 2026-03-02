## Why

Feature planning is already implemented, but execution is still mixed into planning and does not provide a dedicated run workspace for approved test cases. A separate Execution phase is needed so QA users can run approved cases quickly, track run outcomes, and understand current feature coverage at a glance.

## What Changes

- Add a dedicated Feature `Execution` page/phase that lists approved test cases for the selected feature.
- Add phase navigation in the feature header for both pages so users can switch between `Planning` and `Execution`.
- Show read-only feature title on the Execution page.
- Add execution status overview cards that summarize `Passed`, `Failed`, and `Running` counts for approved test cases.
- Add an execution list filter with `All`, `Passed`, `Failed`, and `Running`.
- Show each approved test case row with title, priority tag, and test-type tag.
- Add per-row actions:
- `Edit` opens the test-case workspace for step authoring.
- `Run` triggers execution when the test case has at least one step.
- Hide `Run` for test cases without steps.
- Show a status indicator before each title:
- gray when never run,
- green for latest successful run,
- red for latest failed run,
- blue while currently running.

## Capabilities

### New Capabilities
- `feature-test-case-execution`: Execution-phase workspace for approved test cases, including run controls, status indicators, filtering, and summary metrics.

### Modified Capabilities
- `project-features-planning`: Add phase-level navigation controls in the feature header so users can switch between Planning and Execution views.

## Impact

- Renderer feature page route composition and shared feature header components.
- Approved test-case list querying, filtering, and UI state in the renderer.
- Test-case row actions and navigation wiring to the test-case workspace route.
- Run trigger and run-status mapping logic (using existing execution/run records where available).
- Possible IPC contract updates if run-summary or execution-list queries/actions are missing from existing handlers.
