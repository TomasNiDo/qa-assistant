## ADDED Requirements

### Requirement: AI Scenario Generation Uses Feature Planning Context
The system SHALL generate planning scenario drafts using the selected feature's `title`, parent project context, and feature `acceptanceCriteria`.

#### Scenario: Generate scenarios from selected feature context
- **WHEN** a user triggers AI scenario generation for a valid feature
- **THEN** the system builds an LLM prompt that includes the feature title, project context, and acceptance criteria
- **AND** the system requests scenario output using the configured Gemini model

### Requirement: AI Scenario Output Must Follow A Strict JSON Contract
The system SHALL require model output in JSON format with top-level key `scenarios` containing scenario objects with `title`, `type`, and `priority`.

#### Scenario: Accept valid JSON scenario response
- **WHEN** the LLM returns JSON with `scenarios` as an array of valid scenario objects
- **THEN** the system parses the payload successfully and continues validation

#### Scenario: Reject non-JSON or malformed JSON output
- **WHEN** the LLM response is not parseable JSON or does not match the expected top-level structure
- **THEN** the system returns a structured generation failure response
- **AND** the system does not insert any generated drafts

### Requirement: AI Scenario Validation And Sanitization Must Be Enforced
The system SHALL validate and sanitize generated scenarios before persistence.

#### Scenario: Filter and normalize generated scenarios
- **WHEN** parsed scenarios are received from the LLM
- **THEN** the system trims title whitespace and removes entries with empty titles
- **AND** the system rejects entries whose `type` is not in (`positive`, `negative`, `edge`)
- **AND** the system rejects entries whose `priority` is not in (`high`, `medium`, `low`)

#### Scenario: Remove duplicates and cap result size
- **WHEN** parsed scenarios contain duplicate titles or more than 20 valid entries
- **THEN** the system removes duplicates using normalized title comparison
- **AND** the system persists at most 20 validated scenarios

### Requirement: Generated Scenarios Must Persist As Drafts With AI Provenance
The system SHALL store accepted AI scenarios in the planning draft dataset with AI provenance metadata and without approval side effects.

#### Scenario: Persist AI-generated draft metadata
- **WHEN** one or more validated scenarios are ready for insertion
- **THEN** each inserted scenario is marked as AI-generated and not user-edited
- **AND** each inserted scenario is saved in drafted planning state

#### Scenario: No automatic approval during AI generation
- **WHEN** AI-generated scenarios are inserted
- **THEN** the system does not auto-approve or auto-promote them to execution-ready state
- **AND** human review remains required before approval

### Requirement: Regeneration Must Preserve Manual Drafts
The system SHALL preserve manually authored planning drafts when AI scenario generation is triggered repeatedly.

#### Scenario: Re-generate scenarios in append mode
- **WHEN** a user runs AI generation again for the same feature
- **THEN** the system appends newly validated AI drafts to existing drafts
- **AND** manually created drafts remain unchanged

### Requirement: Generation Failures Must Return Structured Errors
The system SHALL return structured error responses for generation failures without crashing the planning workspace.

#### Scenario: Missing API key or provider timeout
- **WHEN** generation fails due to missing provider configuration or model timeout
- **THEN** the system returns a failure payload with `success=false` and an explanatory message
- **AND** the renderer can continue normal interaction after showing a non-blocking error
