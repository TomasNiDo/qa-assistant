## ADDED Requirements

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
