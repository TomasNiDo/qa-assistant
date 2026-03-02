## ADDED Requirements

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
