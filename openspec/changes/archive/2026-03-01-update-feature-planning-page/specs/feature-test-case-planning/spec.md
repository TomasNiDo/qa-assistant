## MODIFIED Requirements

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

## ADDED Requirements

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
