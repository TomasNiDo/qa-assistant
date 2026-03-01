## 1. Feature Planning Entry And Page Structure

- [x] 1.1 Replace feature-create modal entry points with navigation to a dedicated Feature Planning route.
- [x] 1.2 Build the Feature Planning page in empty/create mode with form fields for `Title`, `Acceptance Criteria`, `Requirements`, and `Notes`.
- [x] 1.3 Ensure existing feature open/edit paths resolve to the same dedicated Feature Planning page.

## 2. Feature Form Autosave

- [x] 2.1 Implement local form dirty tracking and debounced autosave for feature field edits.
- [x] 2.2 Wire autosave to existing feature create/update data flows and display save/error status in-page.
- [x] 2.3 Enforce acceptance-criteria validation behavior during autosave and surface validation feedback.

## 3. Drafted Test Case Workflow In Feature Page

- [x] 3.1 Add an `Add Test Case` button below the Feature form that opens a modal with `title`, `priority`, and `testType` inputs.
- [x] 3.2 Update create/edit payload handling so test cases created from this flow always persist `isAiGenerated=false` without a visible UI control.
- [x] 3.3 Render a `Drafted Test Cases` section listing test cases with title and metadata pills.
- [x] 3.4 Implement edit action from drafted list items using a prefilled modal and persist updated metadata.
- [x] 3.5 Implement delete action from drafted list items and refresh list state after deletion.

## 4. Remove Legacy Planning Surfaces And Sidebar Test Case Navigation

- [x] 4.1 Remove the current inline test-case planning form from the Feature Planning page.
- [x] 4.2 Remove run-history content from the Feature Planning page.
- [x] 4.3 Update sidebar rendering from `Project -> Feature -> Test Cases` to `Project -> Feature` only.
- [x] 4.4 Remove sidebar add-test-case button/shortcut and dependent handlers.

## 5. Contracts, Tests, And QA Verification

- [x] 5.1 Sync `src/shared/ipc.ts` and `src/shared/types.ts` with any handler/preload payload changes introduced by autosave and drafted test-case flows.
- [x] 5.2 Update renderer/main-process tests for feature autosave, modal test-case create/edit/delete, and sidebar hierarchy changes.
- [ ] 5.3 Execute manual verification for: autosave persistence, drafted list rendering, edit/delete behavior, and absence of sidebar test-case nodes/buttons.
