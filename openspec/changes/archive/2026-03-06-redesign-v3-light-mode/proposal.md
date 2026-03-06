## Why

The V3 redesign is currently dark-mode-only, while the latest approved design includes a full light-mode theme and an updated sidebar mode toggle. We need to implement this now to match `design/design-v3.pen` and deliver complete theme support without changing MVP behavior.

## What Changes

- Add V3 light-mode token coverage and component styling parity across core renderer surfaces (sidebar, planning, execution, and bug report modal contexts used in V3 references).
- Implement runtime theme switching between dark and light modes through the updated sidebar light/dark toggle design.
- Update sidebar footer/toggle layout and interaction states to match the approved light-mode sidebar design patterns in `design/design-v3.pen`.
- Keep all existing planning/execution functionality, IPC contracts, and SQLite/local-first behavior unchanged.

## Capabilities

### New Capabilities
- `design-system-v3-light-mode`: Define and enforce V3 light-mode rendering requirements and screen parity for core QA assistant workflows.

### Modified Capabilities
- `design-system-v3-dark-mode`: Extend requirements to include dual-mode toggle behavior and consistent sidebar toggle interaction/state expectations when dark mode is active.

## Impact

- Affected code: `src/renderer/src/` theme tokens, shared UI primitives, app shell/sidebar, and major planning/execution screen styling.
- Affected design reference: `design/design-v3.pen` (notably "Approved Sidebar Design - Light" and V2 Light route variants).
- APIs/IPC/data: No intended changes to `src/shared/ipc.ts`, `src/shared/types.ts`, or SQLite schema/migrations.
