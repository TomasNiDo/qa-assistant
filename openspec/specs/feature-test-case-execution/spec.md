# feature-test-case-execution Specification

## Purpose
TBD - created by archiving change feature-execution-page. Update Purpose after archive.
## Requirements
### Requirement: Execution Phase Lists Approved Test Cases For A Feature
The system SHALL show approved test cases for the selected feature in the Feature Execution page.

#### Scenario: Show approved test case metadata in execution list
- **WHEN** a user opens the Execution phase for a feature that has approved test cases
- **THEN** the page lists those approved test cases
- **AND** each row shows the test case `title`, `priority` tag, and `testType` tag

#### Scenario: Exclude drafted test cases from execution list
- **WHEN** a feature has both drafted and approved test cases
- **THEN** only test cases with planning status `approved` appear in the Execution page list

### Requirement: Execution List Supports Run-State Filtering
The system SHALL provide execution list filters `All`, `Passed`, `Failed`, and `Running`.

#### Scenario: Filter to passed test cases
- **WHEN** a user selects the `Passed` filter
- **THEN** the list shows only approved test cases whose latest run state is passed

#### Scenario: Filter to failed test cases
- **WHEN** a user selects the `Failed` filter
- **THEN** the list shows only approved test cases whose latest run state is failed

#### Scenario: Filter to currently running test cases
- **WHEN** a user selects the `Running` filter
- **THEN** the list shows only approved test cases with an active running execution

### Requirement: Execution Rows Show Status Indicator Before Title
The system SHALL render a color indicator before each test-case title to reflect current execution status.

#### Scenario: Gray indicator for never-run test case
- **WHEN** an approved test case has no historical run
- **THEN** the row shows a gray indicator before the title

#### Scenario: Green indicator for successful latest run
- **WHEN** an approved test case latest completed run is passed
- **THEN** the row shows a green indicator before the title

#### Scenario: Red indicator for failed latest run
- **WHEN** an approved test case latest completed run is failed
- **THEN** the row shows a red indicator before the title

#### Scenario: Blue indicator for running test case
- **WHEN** an approved test case is currently running
- **THEN** the row shows a blue indicator before the title

### Requirement: Execution Rows Provide Edit And Conditional Run Actions
The system SHALL provide `Edit` and conditional `Run` actions for each approved test case row.

#### Scenario: Edit action opens test-case workspace
- **WHEN** a user activates the row `Edit` action
- **THEN** the system opens the test-case workspace for that test case
- **AND** the user can author or update execution steps

#### Scenario: Run action is shown when test case has steps
- **WHEN** an approved test case has one or more saved steps
- **THEN** the row shows a `Run` action

#### Scenario: Run action is hidden when test case has no steps
- **WHEN** an approved test case has no saved steps
- **THEN** the row does not show a `Run` action

### Requirement: Execution Page Shows Status Overview And Coverage
The system SHALL show execution summary cards and feature coverage for approved test cases.

#### Scenario: Show passed, failed, and running counts
- **WHEN** a user opens the Execution page
- **THEN** summary cards show counts for `Passed`, `Failed`, and `Running` approved test cases

#### Scenario: Show feature coverage from approved execution progress
- **WHEN** approved test cases exist for the feature
- **THEN** the page shows feature coverage computed from approved test cases with at least one completed run over total approved test cases

