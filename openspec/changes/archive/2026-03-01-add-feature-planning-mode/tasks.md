## 1. Data Model and Migration

- [x] 1.1 Add a migration that creates `features` with required planning fields and project foreign key.
- [x] 1.2 Add migration columns to test cases for `feature_id`, `test_type`, `priority`, and `is_ai_generated`.
- [x] 1.3 Backfill one `Imported` feature per existing project and assign legacy test cases to it.
- [x] 1.4 Enforce not-null feature ownership and cascade-delete constraints at the database level.
- [x] 1.5 Update startup smoke checks for any newly required tables/columns.

## 2. Main Process Services and Contracts

- [x] 2.1 Add shared types for Feature and planning-mode test case payloads/results.
- [x] 2.2 Add IPC channels, preload bridge methods, and Zod schemas for feature CRUD and feature-scoped test case operations.
- [x] 2.3 Implement a feature service for create/list/update/delete with acceptance-criteria validation.
- [x] 2.4 Refactor test-case service methods to require `featureId` and planning metadata while allowing no steps in planning mode.
- [x] 2.5 Update run/project query joins to remain correct with feature-owned test cases.

## 3. Renderer Planning Mode UX

- [x] 3.1 Refactor state model to track `selectedFeatureId` in addition to project and test selection.
- [x] 3.2 Update sidebar hierarchy to `Project -> Feature -> Test Case` and feature-level actions.
- [x] 3.3 Add feature create/edit form fields (`title`, `acceptanceCriteria`, `requirements`, `notes`).
- [x] 3.4 Update test case form to planning metadata fields (`title`, `testType`, `priority`, `isAiGenerated`) and remove step-authoring requirement in this phase.
- [x] 3.5 Ensure UX clearly reflects planning mode and prevents invalid save attempts.

## 4. Seeds and Test Coverage

- [x] 4.1 Update sample seed flow to create features and place seeded test cases under a feature.
- [x] 4.2 Update service unit tests for feature CRUD, required acceptance criteria, and non-unique title behavior.
- [x] 4.3 Update test-case service tests for required feature ownership, planning enums, and no-step planning saves.
- [x] 4.4 Update fake DB SQL handlers and integration tests for the new schema/query patterns.
- [x] 4.5 Add migration-focused regression tests for `Imported` feature backfill behavior.

## 5. Verification and Rollout Readiness

- [x] 5.1 Run typecheck, lint, and automated tests for main/renderer after refactor.
- [x] 5.2 Validate upgrade path on an existing local database snapshot.
- [x] 5.3 Verify feature delete cascades through child test cases and dependent execution records.
- [x] 5.4 Document deferred AI prompt enrichment as explicitly out of scope for this phase.
