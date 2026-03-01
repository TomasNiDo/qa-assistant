## Why

Feature planning currently treats all planned tests as a single drafted list, which makes it hard to triage readiness and decide what is approved for execution preparation. Adding explicit drafted-versus-approved flows improves planning clarity and helps teams promote only vetted test cases.

## What Changes

- Add triage support on the Feature Planning page so users can move test cases between `Drafted Test Cases` and `Approved Test Cases`.
- Add an `Approved Test Cases` section that displays approved items.
- In `Drafted Test Cases`, add per-item approve action (checkmark icon) and delete action.
- Show selection checkmarks on drafted items and add an `Approved Test Cases` bulk action button to approve selected drafted test cases.
- In `Approved Test Cases`, add per-item move-back action (to return case to drafted) and delete action.
- Keep test-case metadata display in both sections, with approved/drafted movement reflected immediately in the UI.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `project-features-planning`: Update Feature Planning workspace requirements to include both drafted and approved test-case sections and bulk approval interaction.
- `feature-test-case-planning`: Add requirements for test-case triage state transitions (approve, bulk approve, move back), plus section-specific actions and deletion behavior.

## Impact

- Renderer Feature Planning page layout/state management and drafted-list interactions.
- Test-case persistence/query logic to represent approved vs drafted planning state.
- IPC and shared types only if triage state fields or endpoints require contract updates.
- Existing local-only SQLite and MVP scope assumptions remain unchanged.
