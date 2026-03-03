# feature-ai-step-generation Specification

## Purpose
TBD - created by archiving change test-steps-enhanced-ai-generation. Update Purpose after archive.
## Requirements
### Requirement: AI Step Generation Uses Test Case And Project Context
The system SHALL generate AI execution steps using the provided test-case title and project context values.

#### Scenario: Generate from title and project context
- **WHEN** a user requests AI step generation with a valid title and project context
- **THEN** the system builds a model prompt from that title and project context
- **AND** the system does not depend on unrelated workspace records for step content

### Requirement: AI Step Output Must Follow Strict JSON Contract
The system SHALL require AI step-generation responses to be strict JSON with top-level key `steps` containing an array of non-empty step strings.

#### Scenario: Accept valid strict JSON step payload
- **WHEN** the model returns valid JSON with `steps` as an array of non-empty strings
- **THEN** the system parses the payload successfully
- **AND** the system continues grammar validation for each returned step string

#### Scenario: Reject malformed or non-conforming payload
- **WHEN** the model returns non-JSON output or JSON that does not match `{ "steps": string[] }`
- **THEN** the system returns a structured generation failure
- **AND** the system does not return invalid step strings to the renderer

### Requirement: Generated Steps Must Match Canonical Grammar Patterns
The system SHALL only accept generated steps that match one of two canonical grammar patterns with double-quoted values and targets.

#### Scenario: Accept value-based grammar pattern
- **WHEN** a generated step uses `<Action> "<Value>" in "<Target>" using <LocatorKind>`
- **THEN** the system accepts the step for actions that require value-plus-target grammar
- **AND** the step remains a single-line string

#### Scenario: Accept target-only grammar pattern
- **WHEN** a generated step uses `<Action> "<Target>" using <LocatorKind>`
- **THEN** the system accepts the step for target-only actions
- **AND** the step remains a single-line string

#### Scenario: Reject non-canonical grammar
- **WHEN** a generated step is missing required quotes, missing `using <LocatorKind>`, or uses a different sentence structure
- **THEN** the system rejects that step as invalid
- **AND** invalid steps are not returned in successful results

### Requirement: Generated Steps Must Enforce Action And Locator Allowlists
The system SHALL enforce only approved actions and locator kinds for accepted generated steps.

#### Scenario: Accept only allowed actions and locator kinds
- **WHEN** a generated step uses an allowed action and locator kind
- **THEN** the system accepts the step if it also passes grammar validation
- **AND** locator kinds are limited to `role`, `text`, `label`, `placeholder`, `testId`, `css`, and `xpath`

#### Scenario: Reject unsupported action or locator kinds
- **WHEN** a generated step uses an unsupported action or locator kind
- **THEN** the system rejects that step
- **AND** the system does not emit rewritten natural-language alternatives

### Requirement: Generated Steps Must Be Sanitized And Deduplicated
The system SHALL sanitize generated step strings before returning them to the renderer.

#### Scenario: Remove empty and duplicate generated steps
- **WHEN** the model response contains blank, repeated, or whitespace-variant duplicates
- **THEN** the system removes blank entries and de-duplicates normalized duplicates
- **AND** only unique valid steps are returned

#### Scenario: Omit uncertain or invalid generated steps
- **WHEN** a candidate step cannot be validated against the required grammar and allowlists
- **THEN** the system omits that step instead of returning a potentially invalid command
- **AND** remaining valid steps continue through result assembly

### Requirement: Generation Failure Must Be Structured When No Valid Steps Remain
The system SHALL return a structured failure when zero valid steps remain after validation and sanitization.

#### Scenario: Return structured failure for empty-valid set
- **WHEN** all generated candidate steps are rejected or omitted
- **THEN** the system returns a failure response with an explanatory message
- **AND** the renderer can present the failure without crashing the workspace

