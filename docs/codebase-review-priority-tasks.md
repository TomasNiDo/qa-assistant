# Codebase Review: P1/P2 Task Backlog

This file tracks high-priority work from the latest whole-repo review.

## P1 Tasks (Do Next)

### 1) Make DB migrations packaging-safe
- Priority: `P1`
- Risk: app startup failure in packaged builds.
- Evidence:
  - `src/main/services/database.ts`
  - `out/main/index.js`
- TODO:
  - [x] Stop resolving migrations from `process.cwd()/src/main/db/migrations`.
  - [x] Resolve migration SQL from packaged app resources (non-dev path).
  - [x] Add startup smoke test that runs against built output.

### 2) Guard active run integrity during destructive deletes
- Priority: `P1`
- Risk: run lifecycle inconsistency when project/test is deleted mid-run.
- Evidence:
  - `src/renderer/src/App.tsx`
  - `src/main/services/testCaseService.ts`
  - `src/main/services/projectService.ts`
  - `src/main/services/runService.ts`
- TODO:
  - [x] Block project/test delete actions in UI while a run is active.
  - [x] Add service-level guard against deleting currently-running test/project data.
  - [x] Harden run result updates to handle missing/deleted rows safely.

### 3) Add runtime IPC input validation
- Priority: `P1`
- Risk: invalid payloads can enter DB and destabilize downstream flows.
- Evidence:
  - `src/main/ipc/registerHandlers.ts`
  - `src/main/services/projectService.ts`
  - `src/main/services/testCaseService.ts`
- TODO:
  - [x] Define Zod schemas per IPC request payload.
  - [x] Validate payloads in `registerHandlers` before calling services.
  - [x] Normalize + enforce non-empty constraints for core fields (project name, test title, step list).

## P2 Tasks (Plan This Sprint)

### 4) Improve AI request resilience
- Priority: `P2`
- Risk: request hangs, brittle parse behavior, user-facing instability.
- Evidence:
  - `src/main/services/aiService.ts`
- TODO:
  - [x] Add request timeout with `AbortController`.
  - [x] Add bounded retry/backoff for transient failures.
  - [x] Improve JSON extraction/validation for model output.
  - [x] Classify errors for better UI messaging.

### 5) Reduce screenshot memory pressure in renderer
- Priority: `P2`
- Risk: memory spikes and sluggish UI for longer runs.
- Evidence:
  - `src/main/services/runService.ts`
  - `src/renderer/src/App.tsx`
- TODO:
  - [ ] Add thumbnail generation and show thumbnails in list view.
  - [ ] Lazy-load screenshot content only when row/panel is opened.
  - [ ] Avoid eager base64 loading for all step cards.

### 6) Decompose renderer App component
- Priority: `P2`
- Risk: high regression probability and slower iteration speed.
- Evidence:
  - `src/renderer/src/App.tsx`
- TODO:
  - [ ] Split orchestration into domain hooks (`projects`, `tests`, `runs`, `bug-report`).
  - [ ] Extract presentational sections into components.
  - [ ] Add focused tests for extracted units.

### 7) Harden Electron runtime security defaults
- Priority: `P2`
- Risk: larger blast radius if renderer injection/XSS happens.
- Evidence:
  - `src/main/index.ts`
  - `src/renderer/index.html`
- TODO:
  - [ ] Re-evaluate `sandbox: false` and enable sandbox where feasible.
  - [ ] Define and enforce a strict Content Security Policy.
  - [ ] Confirm no remote content/script execution paths bypass preload boundary.

### 8) Expand tests for critical runtime paths
- Priority: `P2`
- Risk: regressions in core run/IPC/migration behavior are currently untested.
- Evidence:
  - `src/main/services/__tests__/`
  - `src/main/services/runService.ts`
  - `src/main/services/database.ts`
- TODO:
  - [x] Add real-SQLite integration tests for migration + CRUD constraints.
  - [x] Add run lifecycle tests (start, cancel, failure, continue-on-failure).
  - [x] Add IPC contract tests for validation and error shaping.

## Suggested sequencing
1. P1-1 Migrations
2. P1-2 Active run/delete integrity
3. P1-3 IPC runtime validation
4. P2-8 Runtime-path tests (to lock in P1 fixes)
5. P2-4 AI resilience
6. P2-5 Screenshot performance
7. P2-6 App decomposition
8. P2-7 Electron hardening
