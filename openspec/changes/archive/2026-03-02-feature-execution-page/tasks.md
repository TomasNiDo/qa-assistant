## 1. Feature Phase Navigation

- [x] 1.1 Add shared feature header phase navigation (`Planning`/`Execution`) and wire active-state styling for both pages.
- [x] 1.2 Add app state transitions so phase switches keep the same selected project/feature context.
- [x] 1.3 Keep existing Planning page behavior intact while rendering Execution page when `Execution` is selected.

## 2. Execution Data Model And Contracts

- [x] 2.1 Add execution-list data shaping for approved test cases, including latest run state and `hasSteps` flag.
- [x] 2.2 Add/extend IPC handlers and preload/shared contracts (`src/shared/ipc.ts`, `src/shared/types.ts`) for execution summary/list data if current APIs are insufficient.
- [x] 2.3 Compute execution aggregates for passed/failed/running counts and feature coverage from approved test cases.

## 3. Execution Page UI

- [x] 3.1 Build Feature Execution page shell with read-only feature title and phase-consistent header.
- [x] 3.2 Add status overview cards for `Passed`, `Failed`, and `Running`, plus feature coverage display.
- [x] 3.3 Add execution list filters `All`, `Passed`, `Failed`, and `Running` and bind them to list state.
- [x] 3.4 Render approved test case rows with status indicator, title, priority tag, and test-type tag.

## 4. Row Actions And Execution Behavior

- [x] 4.1 Implement `Edit` row action to open the target test case in the test-case workspace for step authoring.
- [x] 4.2 Implement conditional `Run` action visibility: show only when test case has at least one step.
- [x] 4.3 Wire `Run` action to existing run-start flow and refresh execution-row status + overview metrics after run updates.

## 5. Verification

- [x] 5.1 Add/update unit/component tests for phase toggle behavior, execution filters, row indicators, and conditional run button visibility.
- [x] 5.2 Add/update integration tests for execution summary/list contract behavior and status mapping from run history.
- [x] 5.3 Execute manual QA for: planning/execution switching, edit navigation, run visibility without steps, run status colors, and summary-card correctness.
