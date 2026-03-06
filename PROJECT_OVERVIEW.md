# QA Assistant Project Overview

## What this project is
`qa-assistant` is a local-first Electron desktop app for QA planning and execution. It helps you:
- Organize work as `Project -> Feature -> Test Case`
- Draft and triage test scenarios before execution
- Generate steps and scenarios with AI
- Execute approved tests with Playwright-backed browser automation
- Inspect run timelines, step-level evidence, and screenshots

This repo is the MVP foundation and is intentionally scoped for single-user local workflows.

## Tech stack and architecture
- Desktop shell: Electron + `electron-vite`
- UI: React 18 + TypeScript + Tailwind CSS v4
- Persistence: SQLite via `better-sqlite3` + SQL migrations
- Automation runtime: Playwright (`chromium`, `firefox`, `webkit`)
- AI provider/model: Gemini API, model `gemini-2.5-flash`
- Contracts: Typed IPC channels and shared TypeScript types in `src/shared`

Core code locations:
- Main process: `src/main/`
- Preload bridge: `src/preload/index.ts`
- Renderer: `src/renderer/src/`
- Shared contracts/types: `src/shared/`
- DB migrations: `src/main/db/migrations/`

## Implemented features
### Core domain and data
- Project CRUD (`name`, `baseUrl`, `envLabel`, metadata JSON)
- Feature CRUD (`title`, `acceptanceCriteria`, `requirements`, `notes`)
- Test case CRUD under features with planning metadata:
  - `testType`: `positive | negative | edge`
  - `priority`: `high | medium | low`
  - `planningStatus`: `drafted | approved`
  - `isAiGenerated` provenance flag
- Step storage and parsing into structured `actionJson`
- Run history and per-step results with optional screenshot evidence
- Feature-level execution summary:
  - Passed/Failed/Running counts
  - Coverage over approved cases

### Planning features
- Dedicated Feature Planning page
- Feature form autosave (title + acceptance criteria required)
- Drafted vs Approved triage workspace
- Individual approve/move-back/delete actions
- Bulk approval of selected drafted test cases
- AI scenario generation for planning drafts:
  - Uses project + feature + acceptance criteria context
  - Appends generated scenarios as drafted
  - Tags generated rows with `AI` badge

### Execution and workspace features
- Dedicated Feature Execution page for approved test cases only
- Execution filters: `All`, `Passed`, `Failed`, `Running`
- Per-test status indicator and run eligibility (`Run` shown only when steps exist)
- Test Case Workspace:
  - Steps editor with parsing feedback
  - Playwright code view with syntax highlighting
  - Optional custom code mode with syntax validation
  - AI step generation from test title + project context
- Run Center:
  - Run timeline and focused run details
  - Step result cards
  - Screenshot thumbnail/fullscreen viewer, zoom, copy image
  - Immediate cancel action

### Runtime and platform features
- Browser runtime management (install/check status for Chromium/Firefox/WebKit)
- Browser installation progress events streamed to renderer
- Step writing guide page (`step-guide.html`) openable from the app
- Auto-update plumbing for packaged Windows builds (`electron-updater`)
- Sample project/feature/test seed service

### AI features (current state)
- AI step generation:
  - Strict JSON contract
  - Canonical grammar + allowlists + dedupe + sanitation
- AI scenario generation:
  - Strict JSON contract with validation/sanitization
  - Duplicate filtering, capped insert volume, append mode
- AI bug report generation:
  - Implemented in main service
  - Restricted to failed runs
  - Renderer workspace currently keeps report action disabled

## End-to-end workflows
### 1. First run and setup
1. App boots and checks browser install state.
2. If no browser runtime is installed, user lands on Install Browsers screen.
3. User installs at least one browser, then enters main workspace.

### 2. Create project and feature
1. Create a project with valid URL (must include protocol).
2. Create/select a feature.
3. Fill feature planning fields; autosave persists changes.

### 3. Plan test scenarios
1. Add drafted test cases manually, or generate via AI scenarios.
2. Review drafted list with metadata pills and AI badges.
3. Approve individually or in bulk; approved cases move to execution-ready list.

### 4. Execute approved tests
1. Switch to Execution phase for the selected feature.
2. Filter and inspect approved cases by latest run state.
3. Open a case in workspace to edit steps/code or run directly (if steps exist).

### 5. Author steps and code
1. In workspace, edit step lines in guided mode.
2. Parser validates each line and surfaces errors/warnings.
3. Optionally generate steps via AI.
4. Switch to Playwright code view; optionally enable custom code editing.

### 6. Run and inspect results
1. Start run with selected browser.
2. Track run updates and step status in Run Center.
3. Cancel immediately when needed.
4. Inspect step evidence and screenshots from timeline cards.

## Project rules and guardrails
### Product and MVP scope rules
- Local-only data assumptions (SQLite-first, no cloud sync/auth/team features by default)
- MVP decisions:
  - AI model: `gemini-2.5-flash`
  - Step parsing: strict grammar + natural-language fallback
  - Cancellation: immediate cancel behavior
  - PII masking: deferred (not in MVP)

### Domain behavior rules
- Feature title and acceptance criteria are required
- Duplicate feature titles are allowed within a project
- Every test case must belong to exactly one feature
- Planning-phase test cases can exist without authored steps
- Approved-only gate for execution list
- Cannot start run if no steps exist
- Only one run can be active at a time
- Delete protections while run is active:
  - Project/feature/test deletion blocked when relevant run is running
- Bug reports can only be generated for failed runs

### AI validation rules
- AI outputs must parse as strict JSON contracts
- Step generation only returns canonical, parse-valid, allowlisted steps
- Invalid/uncertain AI steps are dropped (not rewritten)
- Scenario generation enforces allowed enums, trims/sanitizes titles, removes duplicates, caps results

### Input and contract rules
- IPC payloads are validated with strict Zod schemas
- Unknown keys are rejected for strict object payloads
- Shared IPC channels/types are the contract boundary between renderer and main

### Security/runtime rules
- Electron hardening:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - navigation/window-open/webview restrictions
- CSP is set at runtime and locks down script/object/frame/form sources
- Dev renderer URL is restricted to trusted localhost origins

## Design style and UI language
- Visual direction: dark-only, high-contrast QA control-center aesthetic
- Palette: deep slate/navy surfaces with blue/cyan accents and semantic status colors
- Typography:
  - Sans UI: Inter
  - Code/editor: JetBrains Mono
- Shape system:
  - Rounded cards/pills (`rounded-xl`/`rounded-2xl`/full pills)
  - Soft glassy panels, subtle blur, low-elevation shadows
- Layout model:
  - Persistent left sidebar (`Projects -> Features`)
  - Main pane switches across Planning / Execution / Workspace phases
- Interaction style:
  - Compact action chips and icon buttons
  - Inline validation + warning badges
  - Toast notifications for operations
  - Step syntax token highlighting (action/value/target)

## Dev workflow and commands
- Install: `npm install`
- Configure: copy `.env.example` to `.env`, set `GEMINI_API_KEY`
- Run dev app: `npm run dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm run test`

