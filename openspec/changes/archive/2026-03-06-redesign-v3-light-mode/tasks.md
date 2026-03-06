## 1. Theme State And Persistence

- [x] 1.1 Update `useThemePreference` to support both `light` and `dark` values instead of forcing dark mode.
- [x] 1.2 Persist theme preference in renderer storage and restore it on startup before first interactive render.
- [x] 1.3 Ensure theme class application/removal on `document.documentElement` is correct for both modes.

## 2. Dual-Theme Token Foundation

- [x] 2.1 Refactor `src/renderer/src/styles.css` to define V3 light-mode semantic token defaults in `:root`.
- [x] 2.2 Add `.dark` overrides for dark tokens while preserving existing semantic variable names used by components.
- [x] 2.3 Replace remaining high-visibility hard-coded dark-only values in shared styling layers with semantic tokens where needed.

## 3. Sidebar And Theme Toggle Redesign

- [x] 3.1 Rework `ThemeToggle` to match the V3 sidebar-integrated light/dark toggle pattern and active-state visuals.
- [x] 3.2 Update sidebar footer composition to place and style the mode toggle according to `design/design-v3.pen` approved light design.
- [x] 3.3 Verify toggle interaction updates the active theme without changing current selection/workflow context.

## 4. Screen Parity For Light Mode

- [x] 4.1 Apply light-mode parity adjustments to app shell, feature planning, and test-case planning surfaces.
- [x] 4.2 Apply light-mode parity adjustments to execution and editor-related surfaces used in current MVP flows.
- [x] 4.3 Ensure interactive controls (buttons, filters, row actions, toggle states, focus rings, disabled states) are visually distinct in light mode.

## 5. Validation And Readiness

- [x] 5.1 Run `npm run typecheck` and `npm run lint`, then resolve issues introduced by light-mode work.
- [x] 5.2 Execute manual smoke checks for planning/execution workflows in both modes to confirm unchanged behavior.
- [x] 5.3 Perform final visual parity pass against `design/design-v3.pen` light references and document any non-blocking follow-ups.
