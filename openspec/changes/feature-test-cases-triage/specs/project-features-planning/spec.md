## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Feature Planning Supports Bulk Approval From Drafted List
The system SHALL allow users to approve multiple selected drafted test cases in one action.

#### Scenario: Bulk approve selected drafted test cases
- **WHEN** a user selects multiple drafted test cases and activates the `Approved Test Cases` action button
- **THEN** the selected test cases are moved from `Drafted Test Cases` to `Approved Test Cases`
- **AND** unselected drafted test cases remain in `Drafted Test Cases`
