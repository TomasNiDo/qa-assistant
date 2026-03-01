## Context

Feature planning currently mixes modal creation, inline test-case forms, and sidebar-level test-case navigation. This creates fragmented interactions: users create features in one surface, then manage drafted test cases in another, with redundant controls (including sidebar test-case add actions). The existing data model already supports feature-level test cases and planning metadata, so this change is primarily a UX, state-management, and interaction-flow redesign within the renderer and related IPC usage.

Constraints:
- Keep MVP local-only assumptions and current SQLite-first architecture.
- Avoid introducing cloud/auth/team scope.
- Keep IPC contracts synchronized when payload/behavior changes are needed.

## Goals / Non-Goals

**Goals:**
- Move feature creation/editing into a dedicated Feature Planning page form.
- Auto-save `title`, `acceptanceCriteria`, `requirements`, and `notes` while the user edits.
- Add drafted test-case creation via modal (`title`, `priority`, `testType`) with implicit `isAiGenerated=false`.
- Show drafted test cases under the feature form with metadata pills and edit/delete actions.
- Remove legacy inline test-case form and run-history content from Feature Planning page.
- Simplify sidebar hierarchy to `Project -> Feature` only and remove sidebar test-case add controls.

**Non-Goals:**
- Changes to execution-step authoring or test execution engine.
- New test-case fields beyond current planning metadata.
- Any remote sync, auth, or collaboration behaviors.

## Decisions

1. **Use route-based Feature Planning as the canonical create/edit surface**
- Decision: Replace modal-first feature creation with navigation to a dedicated feature page (new feature opens as empty form state).
- Rationale: Route-based editing supports longer-form inputs (acceptance criteria/requirements/notes), better keyboard flow, and less UI context switching.
- Alternative considered: Keep creation modal and deep-link to page after submit. Rejected because it preserves duplicate flows and does not reduce cognitive overhead.

2. **Implement debounced autosave with field-level dirty tracking**
- Decision: Auto-save feature form changes through existing create/update pathways using debounced writes and a last-saved indicator/error state.
- Rationale: Prevents data loss and removes explicit save friction while limiting write frequency.
- Alternative considered: Save-on-blur only. Rejected because multi-field edits can still be lost if users navigate quickly before blur events complete.

3. **Constrain drafted test-case creation to modal with server-side default for `isAiGenerated`**
- Decision: Modal includes only `title`, `priority`, and `testType`; client sends `isAiGenerated=false` (or omits when backend defaults false) and UI hides this field entirely.
- Rationale: Matches requested UX and prevents inconsistent flag assignment.
- Alternative considered: Expose checkbox with default unchecked. Rejected because requirement explicitly removes this decision from the user.

4. **Render drafted test cases inline on feature page with lightweight actions**
- Decision: Add a `Drafted Test Cases` section under the form, showing list items with title and metadata pills plus edit/delete actions. Edit reuses modal shape with existing values.
- Rationale: Keeps planning context in one place and removes sidebar dependence for test-case management.
- Alternative considered: Keep test-case list in sidebar only. Rejected due to hierarchy simplification requirement and discoverability issues for metadata editing.

5. **Sidebar becomes feature-centric only**
- Decision: Sidebar tree renders projects and features; it no longer includes test-case child nodes or sidebar add-test-case button.
- Rationale: Aligns IA with page-first workflow and avoids duplicate entry points.
- Alternative considered: Hide test-case nodes behind collapse toggle. Rejected because it still retains a conflicting navigation model.

## Risks / Trade-offs

- **[Risk] Autosave races can overwrite newer input during rapid edits** → Mitigation: use request sequencing/version checks and apply only latest successful response.
- **[Risk] Frequent writes may impact perceived performance on low-end machines** → Mitigation: debounce writes, skip unchanged payloads, and batch rapid updates.
- **[Risk] Removing sidebar test-case nodes may reduce quick navigation for some users** → Mitigation: ensure drafted list supports direct open/edit affordances and clear section labeling.
- **[Risk] Existing UI tests may assume modal feature creation path** → Mitigation: update test fixtures/selectors and keep route transition behavior deterministic.

## Migration Plan

1. Add/adjust feature-planning route and page state to support empty-create mode.
2. Replace feature-create modal entry point with navigation to the new page.
3. Introduce autosave flow for feature form with save-status/error handling.
4. Replace inline legacy test-case form/run-history region with drafted test-case list and modal add/edit.
5. Remove sidebar test-case nodes and sidebar add-test-case action.
6. Validate existing records render correctly with no DB migration required.

Rollback strategy:
- Re-enable prior modal/sidebar controls behind a temporary feature flag or by reverting renderer changes; data model remains compatible so rollback is low risk.

## Open Questions

- Should autosave display a timestamp (`Saved at HH:MM`) or only transient status text?
- Should deleting a drafted test case require a confirmation dialog or undo toast?
