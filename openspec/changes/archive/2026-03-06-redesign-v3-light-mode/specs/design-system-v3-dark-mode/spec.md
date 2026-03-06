## MODIFIED Requirements

### Requirement: Renderer Uses V3 Dark Theme Tokens As The Visual Baseline
The system SHALL render core application surfaces using the design tokens defined by the V3 design system when dark mode is active.

#### Scenario: Sidebar toggle activates dark tokens
- **WHEN** a user selects dark mode from the sidebar theme toggle
- **THEN** the renderer applies the V3 dark-mode token set for colors, typography, spacing, borders, and elevation
- **AND** no legacy token set overrides the active V3 dark theme in core shell layouts

#### Scenario: Dark-mode preference is restored on app launch
- **WHEN** a user previously selected dark mode and reopens the desktop app
- **THEN** the renderer initializes with dark mode active
- **AND** the initial shell render does not require manual theme re-selection

### Requirement: Core Planning And Execution Screens Follow V3 Component Structure
The system SHALL present the project sidebar, feature planning, test-case planning, and feature execution screens using V3 component composition and layout structure while dark mode is active.

#### Scenario: Sidebar, theme toggle, and workspace align to V3 layout patterns
- **WHEN** a user views the main app shell in dark mode
- **THEN** sidebar containers, item rows, active states, and sidebar theme-toggle composition follow V3 dark-mode layout patterns
- **AND** workspace content spacing and section hierarchy align with V3 structure

#### Scenario: Planning and execution surfaces align to V3 component patterns
- **WHEN** a user navigates between planning and execution phases for a feature in dark mode
- **THEN** section headers, cards/rows, filters, pills, and action buttons follow V3 dark-mode component styling
- **AND** existing planning and execution actions remain available in their respective surfaces

### Requirement: Interactive Controls Provide Dark-Mode Accessible States
The system SHALL expose distinguishable visual states for interactive controls in dark mode.

#### Scenario: Hover, active, focus, and disabled states are visually distinct
- **WHEN** a user interacts with actionable controls such as buttons, row actions, filters, and the sidebar theme toggle
- **THEN** controls provide distinct hover and active feedback in dark mode
- **AND** keyboard focus indicators are visible on focusable elements
- **AND** disabled states are visually distinguishable from enabled states
