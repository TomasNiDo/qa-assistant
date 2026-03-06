## Context

The renderer currently mixes ad-hoc styles across pages, which creates inconsistent spacing, hierarchy, and component affordances. The project now has a canonical visual source in `design/design-v3.pen` that already includes a UI kit and variable system, and the immediate scope is dark mode only.

Constraints:
- Keep MVP functional behavior unchanged (planning/execution flows, AI actions, and local-first persistence).
- Preserve existing typed IPC contracts in `src/shared/ipc.ts` and `src/shared/types.ts`.
- Limit this change to renderer presentation and interaction design.

Stakeholders:
- Product/design (visual consistency and quality)
- QA users (clearer triage and execution readability)
- Engineering (maintainable component and token architecture)

## Goals / Non-Goals

**Goals:**
- Implement the V3 dark-mode visual system from `design/design-v3.pen` across core renderer screens.
- Centralize tokens (color, typography, spacing, radius, borders, elevations) so pages consume shared primitives instead of custom values.
- Refactor major planning/execution surfaces to use consistent component patterns from the V3 UI kit.
- Keep user workflows and data semantics unchanged while improving visual and interaction quality.

**Non-Goals:**
- Light mode support.
- New feature behavior, schema changes, or IPC/API contract changes.
- PII masking, auth/cloud/team features, or non-MVP scope expansion.

## Decisions

### Decision 1: Establish V3 tokens as the single renderer styling source
- Choice: Introduce/normalize renderer theme tokens to match the pen variables and consume them from shared styles/components.
- Rationale: Prevents value drift and enables consistent dark-mode behavior across all screens.
- Alternatives considered:
  - Keep page-local styles and incrementally tweak values: rejected due to ongoing inconsistency and slower future changes.
  - Hard-code styles from screenshots: rejected because it bypasses the existing variable system in the pen file.

### Decision 2: Recompose screens around reusable V3-aligned UI primitives
- Choice: Update common building blocks (layout containers, cards, buttons, pills, list rows, section headers, states) before page-specific composition.
- Rationale: Shared primitives reduce duplicated styling logic and keep planning/execution pages visually consistent.
- Alternatives considered:
  - One-off page rewrites without primitive refactor: rejected because it repeats style logic and increases maintenance cost.

### Decision 3: Preserve existing interaction/state logic and only restyle surface structure
- Choice: Keep current renderer state flows, IPC calls, and data transformations while replacing layout and visual layers.
- Rationale: Reduces regression risk and keeps this change focused on design adoption.
- Alternatives considered:
  - Simultaneous UX/logic rewrites: rejected because it increases blast radius and complicates validation.

### Decision 4: Implement in slices by screen with visual parity checks against pen
- Choice: Migrate screen-by-screen (sidebar/shell, planning, test-case planning, execution), verifying each slice against `design-v3.pen` references.
- Rationale: Enables incremental verification and makes regressions easier to isolate.
- Alternatives considered:
  - Big-bang rewrite: rejected due to harder debugging and review.

## Risks / Trade-offs

- [Risk] Visual parity gaps between implemented components and pen references, especially spacing/typography nuance.
  → Mitigation: Track per-screen parity checklists and run screenshot/manual comparisons before completion.

- [Risk] Styling refactor may unintentionally affect interaction hit targets, focus states, or overflow behavior.
  → Mitigation: Add/extend renderer component tests for key interactive controls and run manual smoke tests for planning/execution paths.

- [Risk] Existing pages may contain hidden style dependencies not obvious from component boundaries.
  → Mitigation: Move gradually by slices, keep commits focused, and validate each page before continuing.

- [Trade-off] Dark mode only now reduces immediate scope but defers future light-theme work.
  → Mitigation: Keep token naming/theme structure extensible so light mode can be added later without major refactor.

## Migration Plan

1. Baseline current renderer screens and identify V3 target structures from `design/design-v3.pen`.
2. Implement or update shared V3 token layer and foundational primitives.
3. Migrate app shell + sidebar layout.
4. Migrate feature planning and test-case planning sections.
5. Migrate execution page list/cards/filters/actions.
6. Run typecheck/lint and focused UI smoke tests for unchanged behavior.
7. Final visual parity pass against pen and adjust remaining gaps.

Rollback:
- Revert the redesign change set at the renderer layer; no data migration rollback is needed because persistence schemas are unchanged.

## Open Questions

- Which exact pen frames are the canonical source for each route/state variant (default, empty, loading, error)?
    - Sidebar design: Approved Sidebar Design
    - Feature planning page: Feature - Planning Mode V2
    - Feature execution page: Feature - Execution Mode V2
    - Test case workflow page: Test Case Editor - Steps V2 and Test Case Editor - Playwright View V2
    - Bug report: Report Bug Modal
- Are there any intentionally deferred components in `design-v3.pen` that should stay out of this first dark-mode pass?
    - No, create it if there's seem to be any deferred components.
- Do we need explicit keyboard/focus visual specs from design for all interactive controls beyond current implementation defaults?
    - That can be later
