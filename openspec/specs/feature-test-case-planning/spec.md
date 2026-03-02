# feature-test-case-planning Specification

## Purpose
TBD - created by archiving change add-feature-planning-mode. Update Purpose after archive.
## Requirements
### Requirement: Test Case Must Belong to Exactly One Feature
The system SHALL require every test case to reference exactly one feature.

#### Scenario: Create test case under feature
- **WHEN** a user creates a test case with a valid feature identifier
- **THEN** the system stores the test case as a child of that feature

#### Scenario: Reject test case without feature
- **WHEN** a user attempts to create a test case without a feature identifier
- **THEN** the system rejects the request with a validation error

### Requirement: Planning-Mode Test Case Metadata
The system SHALL support planning-mode test case fields: `title`, `testType`, `priority`, and `isAiGenerated`, while the Feature Planning add/edit UI only exposes `title`, `testType`, and `priority`, and automatically sets `isAiGenerated` to `false`.

#### Scenario: Create planning test case with allowed enum values from modal
- **WHEN** a user submits the Feature Planning `Add Test Case` modal with `testType` in (`positive`, `negative`, `edge`) and `priority` in (`high`, `medium`, `low`)
- **THEN** the system stores the test case successfully
- **AND** the system persists `isAiGenerated` as `false`

#### Scenario: Update planning test case metadata from feature page
- **WHEN** a user edits a drafted test case `title`, `testType`, or `priority` from the Feature Planning page
- **THEN** the system persists the updated metadata successfully
- **AND** the user is not required to provide or edit `isAiGenerated`

#### Scenario: Reject invalid planning enum values
- **WHEN** a user submits a test case with unsupported `testType` or `priority`
- **THEN** the system rejects the request with a validation error

### Requirement: Planning Phase Does Not Require Step Authoring
The system SHALL allow planning-mode test cases to be created and updated without authoring execution steps.

#### Scenario: Save planning test case without steps
- **WHEN** a user saves a planning-mode test case that has metadata only
- **THEN** the system persists the test case successfully

### Requirement: Feature Delete Cascades to Test Cases
The system SHALL cascade-delete all child test cases when a feature is deleted.

#### Scenario: Delete feature removes all child tests
- **WHEN** a user deletes a feature that has child test cases
- **THEN** the system deletes the feature and all of its child test cases
- **AND** related dependent execution records for those test cases are removed by existing cascade rules

### Requirement: Drafted Test Cases Are Listed And Manageable In Feature Planning
The system SHALL list drafted test cases on the Feature Planning page and allow edit and delete actions.

#### Scenario: Display drafted test case cards with metadata pills
- **WHEN** a feature has one or more drafted test cases
- **THEN** the Feature Planning page lists each test case in the `Drafted Test Cases` section
- **AND** each listed item shows the test-case title and metadata pills for planning fields

#### Scenario: Edit drafted test case from list
- **WHEN** a user selects edit for a drafted test case in the list
- **THEN** the system opens an edit surface and saves the updated test-case metadata
- **AND** the list reflects the updated values after save

#### Scenario: Delete drafted test case from list
- **WHEN** a user deletes a drafted test case from the Feature Planning page
- **THEN** the system removes the test case from persistence
- **AND** the deleted test case no longer appears in the drafted list

### Requirement: Planning Test Cases Have Triage Status
The system SHALL persist a planning triage status for each feature test case with states `drafted` and `approved`.

#### Scenario: New planning test case defaults to drafted
- **WHEN** a user creates a planning test case for a feature
- **THEN** the system persists the test case with triage status `drafted`

#### Scenario: Approved test case persists as approved
- **WHEN** a user approves a drafted test case
- **THEN** the system persists triage status `approved`

### Requirement: Drafted Test Cases Can Be Approved Individually
The system SHALL allow per-item approval from the drafted list.

#### Scenario: Approve drafted test case via row action
- **WHEN** a user triggers the approve action on a drafted test case row
- **THEN** the system updates that test case to triage status `approved`
- **AND** the case no longer appears in `Drafted Test Cases`
- **AND** the case appears in `Approved Test Cases`

### Requirement: Approved Test Cases Can Move Back To Drafted
The system SHALL allow approved test cases to be moved back to drafted from the approved section.

#### Scenario: Move approved test case back to drafted
- **WHEN** a user triggers move-back on an approved test case row
- **THEN** the system updates that test case to triage status `drafted`
- **AND** the case no longer appears in `Approved Test Cases`
- **AND** the case appears in `Drafted Test Cases`

### Requirement: Deletion Works In Drafted And Approved Sections
The system SHALL allow deleting planning test cases from both triage sections.

#### Scenario: Delete test case from drafted section
- **WHEN** a user deletes a test case from `Drafted Test Cases`
- **THEN** the system removes the test case from persistence
- **AND** the deleted case no longer appears in either triage section

#### Scenario: Delete test case from approved section
- **WHEN** a user deletes a test case from `Approved Test Cases`
- **THEN** the system removes the test case from persistence
- **AND** the deleted case no longer appears in either triage section

### Requirement: Planning Workspace Provides AI Scenario Generation Action
The system SHALL provide a `Generate Scenarios (AI)` action in Feature Planning mode for the selected feature.

#### Scenario: Start AI generation from planning workspace
- **WHEN** a user clicks `Generate Scenarios (AI)` for a valid feature
- **THEN** the renderer invokes the typed generation IPC command with the selected feature identifier
- **AND** the action enters a loading state until the request completes

#### Scenario: Disable repeat clicks while request is in flight
- **WHEN** AI generation is currently running
- **THEN** the `Generate Scenarios (AI)` action is disabled
- **AND** the user cannot start a second concurrent generation request

### Requirement: Planning Workspace Surfaces AI Generation Outcome
The system SHALL update planning UI state after generation success or failure.

#### Scenario: Show success feedback and append generated drafts
- **WHEN** the generation IPC call returns success with inserted scenarios
- **THEN** the drafted list appends the returned scenarios
- **AND** the UI shows a confirmation message with the generated-scenario count
- **AND** the generate action is re-enabled

#### Scenario: Show non-blocking error on generation failure
- **WHEN** the generation IPC call returns a structured failure response
- **THEN** the UI shows a non-blocking error notification with the returned message
- **AND** the drafted list remains unchanged
- **AND** the generate action is re-enabled

### Requirement: AI-Generated Drafts Are Visually Distinguishable
The system SHALL visually identify drafts whose AI provenance flag is true.

#### Scenario: Render AI badge for generated drafts
- **WHEN** a drafted scenario has `isAiGenerated=true`
- **THEN** the drafted scenario row shows a subtle AI indicator badge
- **AND** drafts without the AI flag are rendered without the badge

