## Why

The current feature-planning workflow splits creation and editing across modals, inline forms, and sidebar shortcuts, which makes planning noisy and harder to scan. A dedicated feature page with autosave and an explicit drafted-test-case section will simplify planning flow and reduce UI clutter.

## What Changes

- Replace modal-based feature creation with a dedicated empty Feature Planning page containing a form with `Title`, `Acceptance Criteria`, `Requirements`, and `Notes`.
- Auto-save the Feature form so edits persist without an explicit save button.
- Add a Test Cases area below the Feature form with an `Add Test Case` button.
- Open a modal for test-case creation that captures `title`, `priority`, and `testType`; set `isAiGenerated` to `false` automatically and remove any UI control for that field.
- After creation, list new entries in a `Drafted Test Cases` section showing title plus metadata pills.
- Allow users to edit and delete drafted test cases from the Feature Planning page.
- Remove the existing inline test-case form and run-history content from the Feature Planning page.
- Simplify sidebar navigation from `Project -> Feature -> Test Cases` to `Project -> Feature` and remove sidebar `Add Test Case` affordances.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `project-features-planning`: Change feature planning entry/interaction model to a dedicated page form with autosave and updated information architecture in sidebar navigation.
- `feature-test-case-planning`: Restrict planning test-case creation to modal metadata entry with implicit `isAiGenerated=false`, and require drafted test-case listing with edit/delete actions in the feature page.

## Impact

- Renderer routes, feature-planning page composition, and sidebar tree rendering logic.
- Feature and test-case UI state management to support autosave and draft list updates.
- IPC contracts and handlers only if existing create/update flows need shape or behavior adjustments.
- No new cloud/auth/team functionality; local-only SQLite behavior remains unchanged.
