## Context

The renderer already uses a V3-inspired dark theme, but current theme plumbing is hard-locked to dark mode (`useThemePreference` always resolves to dark and applies only dark class behavior). `design/design-v3.pen` now includes approved light-mode frames plus an updated sidebar theme toggle structure. This change must add light mode and align sidebar toggle UI while preserving existing planning/execution workflows, IPC contracts, and local-only persistence assumptions.

Primary constraints:
- No behavior changes to planning/execution logic or AI flows.
- No changes to `src/shared/ipc.ts`, `src/shared/types.ts`, or SQLite migrations.
- Theme implementation remains renderer-local and should be safe for Electron desktop runtime.

Stakeholders:
- Product/design: parity with approved V3 light-mode and sidebar toggle visuals.
- QA users: predictable, readable light-mode surfaces with fast theme switching.
- Engineering: maintainable dual-theme token architecture without duplicated page styles.

## Goals / Non-Goals

**Goals:**
- Provide first-class V3 light-mode tokens and component styling across shell, planning, execution, and related modal/panel surfaces used in current flows.
- Preserve dark-mode behavior while enabling runtime switching through the updated sidebar light/dark toggle.
- Centralize dual-theme tokens in shared styling foundations so components consume semantic tokens rather than hard-coded values.
- Keep visual/state parity with `design/design-v3.pen` light-mode references, including sidebar footer/toggle interaction states.

**Non-Goals:**
- New product features, workflow logic changes, or API/IPC contract updates.
- Authentication/cloud/team capabilities or non-MVP scope additions.
- Full redesign beyond V3 references already present in `design/design-v3.pen`.

## Decisions

### Decision 1: Promote theme mode to a real renderer state with persisted preference
- Choice: Update `useThemePreference` to support both `light` and `dark` values, apply/remove the `dark` class correctly, and persist user preference locally (renderer-safe storage).
- Rationale: Existing implementation intentionally forces dark mode; light mode requires deterministic mode restoration and immediate class updates.
- Alternatives considered:
  - Session-only toggle state: rejected because users would lose preference across app restarts.
  - Persisting via new backend storage schema: rejected due to unnecessary scope and migration complexity for MVP.

### Decision 2: Introduce semantic dual-theme token definitions in `styles.css`
- Choice: Define light defaults in `:root` and dark overrides in `.dark`, while keeping existing semantic token names consumed by Tailwind/utilities/components.
- Rationale: Maintains existing component API while expanding to dual-theme styling with minimal component churn.
- Alternatives considered:
  - Create separate light-only stylesheet: rejected due to style drift and higher maintenance.
  - Inline conditional styles in components: rejected due to duplicated logic and weaker consistency.

### Decision 3: Replace floating icon toggle usage with sidebar-integrated toggle composition
- Choice: Align `ThemeToggle` structure/variants with V3 sidebar design (dual-button control and selected-state treatment), and place it in sidebar footer contexts where design specifies.
- Rationale: User request includes an updated sidebar design and additional light/dark toggle pattern; control location/structure are part of the requirement, not only colors.
- Alternatives considered:
  - Keep current floating FAB-style toggle and only recolor: rejected because it does not match approved sidebar design.

### Decision 4: Execute visual migration in low-risk slices with parity checks
- Choice: Implement in sequence: theme plumbing/tokens -> sidebar/toggle -> shared primitives -> page-level light-mode parity adjustments.
- Rationale: Limits regressions and keeps reviewable diffs while preserving existing workflow logic.
- Alternatives considered:
  - Big-bang renderer restyle: rejected due to higher verification risk.

## Risks / Trade-offs

- [Risk] Light-mode token introduction may reduce contrast for existing dark-tuned content surfaces.
  -> Mitigation: Validate contrast and state colors against V3 pen references for text, borders, cards, and inputs before completion.

- [Risk] Theme class switching can cause visual flicker during initial render.
  -> Mitigation: Initialize theme state synchronously from persisted value and apply class before first meaningful paint in hook lifecycle.

- [Risk] Sidebar toggle layout change could affect narrow viewport behavior and hit targets.
  -> Mitigation: Validate sidebar footer sizing/overflow in supported desktop breakpoints and update spacing constraints accordingly.

- [Trade-off] Some legacy hard-coded colors may need targeted cleanup during migration.
  -> Mitigation: Prioritize high-visibility surfaces in this change and leave clearly documented follow-ups only if non-blocking.

## Migration Plan

1. Update theme preference hook to support true light/dark state transitions and persistence.
2. Add dual-theme semantic tokens (`:root` light defaults + `.dark` overrides) and keep existing token names stable.
3. Refactor theme toggle component and sidebar footer placement to match approved light/dark toggle design.
4. Apply light-mode token consumption fixes across shared primitives and core planning/execution surfaces.
5. Validate behavior parity (no workflow changes) and run static checks (`npm run typecheck`, `npm run lint`).
6. Perform manual visual parity review against relevant `design/design-v3.pen` light frames.

Rollback:
- Revert renderer theme/toggle commits to restore prior dark-only behavior; no schema/data rollback required.

## Open Questions

- Should theme preference be shared across all windows if multiple renderer windows are ever opened?
  - Assumption for this change: yes, shared preference via local storage key per app profile.
- Are there any light-mode-only micro-interactions in `design-v3.pen` not yet implemented in dark mode primitives?
  - Assumption for this change: reuse existing interaction model and only align visual presentation/states.
