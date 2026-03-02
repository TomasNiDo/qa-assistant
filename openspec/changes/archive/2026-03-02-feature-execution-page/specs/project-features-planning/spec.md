## ADDED Requirements

### Requirement: Feature Header Supports Planning And Execution Phases
The system SHALL render phase navigation in the feature header so users can switch between `Planning` and `Execution`.

#### Scenario: Show phase navigation on planning page
- **WHEN** a user opens the Feature Planning page
- **THEN** the header shows `Planning` and `Execution` navigation controls
- **AND** `Planning` is visually active

#### Scenario: Switch from planning to execution
- **WHEN** a user selects `Execution` from the feature header
- **THEN** the system opens the Feature Execution page for the same selected feature
- **AND** `Execution` is visually active

#### Scenario: Switch from execution back to planning
- **WHEN** a user selects `Planning` from the feature header while in execution phase
- **THEN** the system opens the Feature Planning page for the same selected feature
- **AND** `Planning` is visually active
