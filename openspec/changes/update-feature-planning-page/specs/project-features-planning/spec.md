## MODIFIED Requirements

### Requirement: Project Feature Planning Records
The system SHALL allow users to create and manage feature planning records under a project through a dedicated Feature Planning page with autosaved form fields.

#### Scenario: Open new feature planning page with empty form
- **WHEN** a user initiates feature creation from a project
- **THEN** the system navigates to a dedicated Feature Planning page
- **AND** the page shows editable fields for `title`, `acceptanceCriteria`, `requirements`, and `notes`

#### Scenario: Auto-save feature planning form edits
- **WHEN** a user changes one or more Feature Planning fields
- **THEN** the system persists those changes without requiring an explicit save action
- **AND** the stored record includes `title`, `acceptanceCriteria`, optional `requirements`, optional `notes`, and timestamps

#### Scenario: Reject feature without acceptance criteria
- **WHEN** a user attempts to create or update a feature with empty acceptance criteria
- **THEN** the system rejects the request with a validation error

## ADDED Requirements

### Requirement: Feature Planning Page Shows Drafted Test Case Workspace
The system SHALL render a drafted test-case workspace below the feature form.

#### Scenario: Show Add Test Case entry point and drafted list section
- **WHEN** a user opens a Feature Planning page
- **THEN** the page shows an `Add Test Case` action below the Feature form
- **AND** the page shows a `Drafted Test Cases` section for that feature

#### Scenario: Remove legacy inline planning form and run history from feature page
- **WHEN** a user opens the Feature Planning page
- **THEN** the page does not render the legacy inline test-case form
- **AND** the page does not render run-history content

### Requirement: Sidebar Uses Feature-Only Hierarchy
The system SHALL present feature planning navigation as `Project -> Feature` without test-case sidebar nodes.

#### Scenario: Sidebar excludes test-case nodes
- **WHEN** a project and its features are displayed in the sidebar
- **THEN** the sidebar shows features as children of the project
- **AND** the sidebar does not display test-case child nodes under features

#### Scenario: Sidebar excludes add-test-case shortcut
- **WHEN** a user views feature entries in the sidebar
- **THEN** the sidebar does not show an add-test-case button or equivalent shortcut
