## ADDED Requirements

### Requirement: Renderer Uses V3 Dark Theme Tokens As The Visual Baseline
The system SHALL render core application surfaces using the design tokens defined by the V3 design system for dark mode.

#### Scenario: App shell initializes with V3 dark tokens
- **WHEN** a user opens the desktop app
- **THEN** the renderer applies the V3 dark-mode token set for colors, typography, spacing, borders, and elevation
- **AND** no legacy token set overrides the active V3 dark theme in core shell layouts

#### Scenario: Shared primitives consume centralized tokens
- **WHEN** renderer UI primitives are used by planning and execution pages
- **THEN** those primitives read styling values from centralized V3 token definitions
- **AND** page-level hard-coded fallback values are not required for default rendering

### Requirement: Core Planning And Execution Screens Follow V3 Component Structure
The system SHALL present the project sidebar, feature planning, test-case planning, and feature execution screens using V3 component composition and layout structure.

#### Scenario: Sidebar and workspace align to V3 layout patterns
- **WHEN** a user views the main app shell with project and feature navigation
- **THEN** sidebar containers, item rows, and active states follow V3 dark-mode layout and component patterns
- **AND** workspace content spacing and section hierarchy align with V3 structure

#### Scenario: Planning and execution surfaces align to V3 component patterns
- **WHEN** a user navigates between planning and execution phases for a feature
- **THEN** section headers, cards/rows, filters, pills, and action buttons follow V3 dark-mode component styling
- **AND** existing planning and execution actions remain available in their respective surfaces

### Requirement: Redesign Preserves Existing User Workflow Behavior
The system SHALL preserve existing MVP workflow behavior while applying the V3 dark-mode redesign.

#### Scenario: Planning workflow semantics remain unchanged
- **WHEN** a user creates, edits, approves, moves back, or deletes planning test cases
- **THEN** the same operations and outcomes remain available after redesign
- **AND** redesign changes do not alter underlying planning data semantics

#### Scenario: Execution workflow semantics remain unchanged
- **WHEN** a user filters execution rows, opens edit, and runs available test cases
- **THEN** the same execution workflow outcomes remain available after redesign
- **AND** redesign changes do not alter execution state logic or run-state meaning

### Requirement: Interactive Controls Provide Dark-Mode Accessible States
The system SHALL expose distinguishable visual states for interactive controls in dark mode.

#### Scenario: Hover, active, focus, and disabled states are visually distinct
- **WHEN** a user interacts with actionable controls such as buttons, row actions, and filters
- **THEN** controls provide distinct hover and active feedback in dark mode
- **AND** keyboard focus indicators are visible on focusable elements
- **AND** disabled states are visually distinguishable from enabled states
