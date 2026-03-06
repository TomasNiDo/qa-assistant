## Why

The current UI no longer matches the latest product direction and introduces visual inconsistency across planning and execution flows. We need to align the app with `design/design-v3.pen` now so implementation can proceed against a single dark-mode source of truth.

## What Changes

- Adopt the V3 UI kit and variable system from `design/design-v3.pen` as the renderer design baseline.
- Redesign key renderer surfaces (projects sidebar, feature planning, test-case planning, and execution views) to match the V3 component structure and spacing system.
- Standardize typography, color tokens, elevations, borders, and interactive states to the V3 dark theme.
- Keep existing MVP behavior and local-only data flows intact while updating presentation and interaction design.

## Capabilities

### New Capabilities
- `design-system-v3-dark-mode`: Enforce V3 dark-mode visual requirements and component usage across core QA assistant app screens.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/renderer/src/` pages/components/styles and shared UI primitives.
- Affected assets: `design/design-v3.pen` as implementation reference.
- APIs/IPC: no intended contract changes; existing IPC contracts remain authoritative.
- Data/storage: no schema or migration changes expected.
