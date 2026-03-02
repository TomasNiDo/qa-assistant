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

