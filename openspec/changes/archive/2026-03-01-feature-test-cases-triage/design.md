## Context

The Feature Planning page currently supports drafted test-case creation, editing, and deletion, but it has no explicit triage state to separate vetted cases from in-progress drafts. Users need a lightweight approval flow in-page, including single and bulk approval, with the ability to move approved items back to drafted.

This change touches renderer page composition, test-case state transitions, and storage/query behavior for planning-mode lists. The existing local SQLite model and IPC-driven architecture remain the foundation.

## Goals / Non-Goals

**Goals:**
- Introduce explicit triage status for feature-level planning test cases (`drafted` vs `approved`).
- Show two sections on Feature Planning page: `Drafted Test Cases` and `Approved Test Cases`.
- Support per-item approve from drafted list and move-back from approved list.
- Support bulk approve from drafted list using selection checkmarks and an `Approved Test Cases` action button.
- Preserve delete action in both sections.

**Non-Goals:**
- Adding execution-step or run-related behaviors for approved items.
- New planning metadata fields beyond existing `title`, `priority`, `testType`, `isAiGenerated`.
- Cross-project triage flows or non-feature-scoped approval queues.

## Decisions

1. **Represent triage with explicit persisted planning status**
- Decision: Add a persisted test-case planning status field (e.g., `planningStatus` enum with `drafted|approved`) rather than deriving approval from UI-only state.
- Rationale: Approval must survive refresh/restart and support list filtering/querying.
- Alternative considered: keep approved IDs in transient renderer state. Rejected because it is non-durable and inconsistent across sessions.

2. **Partition test-case list by status in Feature Planning page**
- Decision: Render two sections by filtering feature test cases on status.
- Rationale: Keeps interaction model simple and aligns with user-requested information architecture.
- Alternative considered: single list with status pill and toggle filter. Rejected because explicit dual sections are required.

3. **Support both single and bulk approval actions in drafted list**
- Decision: Add row-level approve icon plus multi-select checkmarks and one bulk `Approved Test Cases` button.
- Rationale: Covers quick one-off triage and batch triage workflows.
- Alternative considered: bulk-only triage. Rejected because it adds friction for approving one item.

4. **Use symmetric state transitions with immediate list refresh**
- Decision: Approve and move-back both perform persisted updates and then refresh list state immediately.
- Rationale: Ensures users see deterministic movement between sections.
- Alternative considered: optimistic-only UI move without server response. Rejected due potential drift and error ambiguity.

5. **Keep delete behavior available in both sections**
- Decision: Preserve existing delete semantics for drafted and approved cases.
- Rationale: Requested behavior and avoids extra lifecycle complexity.
- Alternative considered: allow delete in drafted only. Rejected because user explicitly requested delete in approved too.

## Risks / Trade-offs

- **[Risk] Bulk approve could partially succeed and confuse users** → Mitigation: execute batch update atomically where possible or report per-item failures clearly and refresh list from source-of-truth.
- **[Risk] New status field can break existing list queries/tests** → Mitigation: default legacy/planning records to `drafted` and update tests/fixtures to include status.
- **[Risk] Action/icon density can reduce readability in drafted rows** → Mitigation: keep actions compact and consistent with existing icon/button affordances.
- **[Risk] Move-back may conflict with concurrent edits** → Mitigation: re-fetch feature test list after each transition and show explicit error toast on failed updates.

## Migration Plan

1. Add status support to test-case storage/contracts (default `drafted` for existing and new records).
2. Update create/edit/update handlers so triage transitions can be persisted.
3. Refactor Feature Planning page lists into drafted/approved sections with per-item and bulk approve actions.
4. Add move-back + delete actions in approved list and keep delete in drafted list.
5. Update tests for list partitioning, transitions, and bulk approval.

Rollback strategy:
- Revert renderer triage controls and status usage while leaving existing test-case data intact (status can be ignored if rollback occurs after deployment).

## Open Questions

- Should bulk approve skip already-approved cases silently or show a no-op message when none are selected?
- Should move-back clear drafted-list selection state for cases that return from approved?
