# project-features-planning Specification

## Purpose
TBD - created by archiving change add-feature-planning-mode. Update Purpose after archive.
## Requirements
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

### Requirement: Feature Titles Are Not Uniqueness-Constrained Per Project
The system SHALL NOT require feature titles to be unique within the same project.

#### Scenario: Duplicate feature titles in same project
- **WHEN** a user creates two features with the same title in one project
- **THEN** the system accepts both features as separate records

### Requirement: Legacy Test Case Migration to Imported Feature
The system SHALL migrate existing project-level test cases into project-level default features named `Imported`.

#### Scenario: Create imported feature and assign legacy tests
- **WHEN** migration runs for a project that has legacy test cases without feature ownership
- **THEN** the system creates one default feature named `Imported` for that project
- **AND** reassigns all legacy test cases in that project to the `Imported` feature

#### Scenario: Preserve legacy tests during migration
- **WHEN** migration completes
- **THEN** all pre-existing test cases remain accessible through their project via a feature association

### Requirement: Feature Planning Page Shows Drafted Test Case Workspace
The system SHALL render a triage workspace below the feature form with both `Drafted Test Cases` and `Approved Test Cases` sections.

#### Scenario: Show drafted and approved test case sections
- **WHEN** a user opens a Feature Planning page
- **THEN** the page shows a `Drafted Test Cases` section
- **AND** the page shows an `Approved Test Cases` section

#### Scenario: Show drafted triage controls
- **WHEN** a user views items in `Drafted Test Cases`
- **THEN** each drafted test case row shows a checkmark beside the title for selection
- **AND** each drafted test case row shows an approve action icon and a delete action

#### Scenario: Show approved triage controls
- **WHEN** a user views items in `Approved Test Cases`
- **THEN** each approved test case row shows a move-back action icon to return it to drafted
- **AND** each approved test case row shows a delete action

### Requirement: Sidebar Uses Feature-Only Hierarchy
The system SHALL present feature planning navigation as `Project -> Feature` without test-case sidebar nodes.

#### Scenario: Sidebar excludes test-case nodes
- **WHEN** a project and its features are displayed in the sidebar
- **THEN** the sidebar shows features as children of the project
- **AND** the sidebar does not display test-case child nodes under features

#### Scenario: Sidebar excludes add-test-case shortcut
- **WHEN** a user views feature entries in the sidebar
- **THEN** the sidebar does not show an add-test-case button or equivalent shortcut

### Requirement: Feature Planning Supports Bulk Approval From Drafted List
The system SHALL allow users to approve multiple selected drafted test cases in one action.

#### Scenario: Bulk approve selected drafted test cases
- **WHEN** a user selects multiple drafted test cases and activates the `Approved Test Cases` action button
- **THEN** the selected test cases are moved from `Drafted Test Cases` to `Approved Test Cases`
- **AND** unselected drafted test cases remain in `Drafted Test Cases`

