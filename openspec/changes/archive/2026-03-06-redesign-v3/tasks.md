## 1. Design Baseline And Token Foundation

- [x] 1.1 Audit `design/design-v3.pen` dark-mode frames and document canonical component/token mappings for shell, planning, and execution surfaces.
- [x] 1.2 Implement/normalize centralized V3 dark theme tokens in renderer styling foundations (colors, typography, spacing, radii, borders, elevations).
- [x] 1.3 Remove or refactor legacy hard-coded style values in shared UI primitives so defaults resolve from centralized tokens.

## 2. Shared UI Primitive Refactor

- [x] 2.1 Update reusable UI primitives (buttons, pills/tags, cards/rows, section headers, container surfaces) to match V3 dark-mode structure and states.
- [x] 2.2 Ensure primitives expose distinct hover, active, focus, and disabled states aligned with dark-mode accessibility expectations.
- [x] 2.3 Add or update component-level tests/story checks (where available) for visual state and behavior regressions in shared primitives.

## 3. App Shell And Navigation Redesign

- [x] 3.1 Refactor the main app shell layout and project/feature sidebar to match V3 spacing, hierarchy, and interaction patterns.
- [x] 3.2 Verify sidebar selection, expansion, and navigation affordances remain behaviorally unchanged after restyling.
- [x] 3.3 Resolve overflow/scroll handling and hit target alignment for sidebar items and shell containers in dark mode.

## 4. Planning And Execution Screen Migration

- [x] 4.1 Recompose feature planning and test-case planning surfaces to V3 dark-mode layout and component patterns while preserving existing actions.
- [x] 4.2 Recompose feature execution list, filters, status indicators, and row actions to V3 dark-mode patterns while preserving existing logic.
- [x] 4.3 Validate that planning/execution workflows (create/edit/approve/move-back/delete/filter/run/edit) keep current outcomes and IPC behavior.

## 5. Verification And Release Readiness

- [x] 5.1 Run static checks (`npm run typecheck`, `npm run lint`) and resolve issues introduced by redesign changes.
- [x] 5.2 Execute focused manual smoke tests for planning and execution user flows in dark mode and record parity gaps against `design-v3.pen`.
- [x] 5.3 Apply final visual parity fixes and prepare implementation PR notes summarizing changed renderer areas and validated behaviors.
