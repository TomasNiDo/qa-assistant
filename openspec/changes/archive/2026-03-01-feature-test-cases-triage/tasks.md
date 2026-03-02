## 1. Data Model And Contracts

- [x] 1.1 Add persisted planning triage status support for test cases (`drafted` and `approved`) with safe defaults for existing records.
- [x] 1.2 Update main-process service and IPC handlers to create/update/read test-case triage status.
- [x] 1.3 Sync shared contracts (`src/shared/types.ts`, `src/shared/ipc.ts`, and related input schemas) for triage operations.

## 2. Feature Planning Triage UI

- [x] 2.1 Update the Feature Planning page to render both `Drafted Test Cases` and `Approved Test Cases` sections.
- [x] 2.2 In drafted rows, add a selection checkmark beside title, approve icon action, and delete button.
- [x] 2.3 Add a bulk `Approved Test Cases` action button that approves all selected drafted test cases.
- [x] 2.4 In approved rows, add move-back icon action and delete button.
- [x] 2.5 Ensure approve, bulk approve, move-back, and delete operations refresh both lists consistently.

## 3. Tests And Verification

- [x] 3.1 Update renderer component/hook tests for section partitioning and triage actions (single approve, bulk approve, move-back, delete).
- [x] 3.2 Update main-process/service tests for triage status persistence and transitions.
- [ ] 3.3 Run typecheck/lint/tests and perform manual verification of drafted/approved movement and button/icon behaviors.
  - Automated checks completed: `npm run typecheck`, `npm run lint`, `npm test`, `openspec validate --changes`.
  - Manual in-app verification of drafted/approved movement and icon/button interactions is still pending.
