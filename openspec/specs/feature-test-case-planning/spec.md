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
The system SHALL support planning-mode test case fields: `title`, `testType`, `priority`, and `isAiGenerated`.

#### Scenario: Create planning test case with allowed enum values
- **WHEN** a user creates a test case with `testType` in (`positive`, `negative`, `edge`) and `priority` in (`high`, `medium`, `low`)
- **THEN** the system stores the record successfully

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

