# QA Assistant

QA Assistant is a local desktop app for planning test coverage, running browser-based QA checks, and drafting bug reports from failed runs. It is built for QA engineers, testers, and developers who want a single workspace for feature planning and execution without moving project data to a cloud service.

## What the app does

- Organizes work by project, feature, and test case.
- Lets you draft test cases manually or generate scenarios with Gemini.
- Parses step-based instructions into Playwright-backed actions.
- Runs tests in installed Chromium, Firefox, or WebKit browsers.
- Stores run history, per-step results, and screenshots locally.
- Drafts bug reports from failed runs, including reproduction steps and failure context.
- Supports generated Playwright code and custom code for advanced cases.

## Current MVP status

The app is usable today, but it is still an MVP.

- Data is stored locally in SQLite under the app's user data directory.
- AI features require a Gemini API key.
- PII masking is not part of the current MVP.
- The product is optimized for local, single-user workflows.

## First-run workflow

1. Create a project and set the base URL for the environment you want to test.
2. Add a feature with acceptance criteria, requirements, and notes.
3. Draft test cases manually or generate scenarios with AI.
4. Review the generated steps or code and make edits if needed.
5. Install at least one browser runtime from the in-app browser installer.
6. Run an approved test case and inspect the step-by-step results.
7. If the run fails, open the bug report draft and copy the report or screenshots.

If you want sample data to explore the app quickly, seed a sample workspace:

```bash
npm run seed:sample
```

## Example step syntax

QA Assistant accepts step-based instructions such as:

```text
Enter "qa.user@example.com" in "Email" field
Enter "password123" in "Password" field
Click "Login"
Expect dashboard is visible
```

The app first tries a strict grammar, then falls back to natural-language parsing when needed. When a target is ambiguous, it surfaces warnings so you can tighten the step before running it.

## Tech stack

- Electron with `electron-vite`
- React and TypeScript
- SQLite via `better-sqlite3`
- Playwright for browser execution
- Gemini API with `gemini-2.5-flash`

## Quick start

### Prerequisites

- Node `20.11.1`
- npm
- A Gemini API key for AI-assisted features

### Setup

1. Install the required Node version:

   ```bash
   nvm install
   nvm use
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

4. Add your Gemini key to `.env`:

   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

5. Start the desktop app:

   ```bash
   npm run dev
   ```

## Development scripts

- `npm run dev` starts the Electron app in development mode.
- `npm run build` builds the app.
- `npm run preview` previews the built app.
- `npm run test` runs the test suite and handles native module rebuilds around the run.
- `npm run typecheck` runs TypeScript checks for main and renderer.
- `npm run lint` runs ESLint.
- `npm run rebuild:native` rebuilds native modules for the Electron runtime.
- `npm run test:smoke:build` builds the app and runs a smoke startup check.
- `npm run dist:win` builds a Windows installer locally.
- `npm run publish:win` builds and publishes Windows release artifacts.

## Project structure

- `src/main/` Electron main process, database, IPC handlers, and services
- `src/preload/` secure preload bridge exposed to the renderer
- `src/renderer/src/` React UI and app workflows
- `src/shared/` shared IPC contracts, validation helpers, and types
- `src/main/db/migrations/` SQLite schema migrations

## Local data and artifacts

- Database: `app.getPath('userData')/qa-assistant/db.sqlite`
- Run artifacts and screenshots: `app.getPath('userData')/qa-assistant/artifacts`

## Contributing

Contributions are welcome. Keep changes focused, consistent with the MVP scope, and grounded in the app's local-first design.

### Before you open a pull request

1. Install dependencies with `npm install`.
2. Create `.env` from `.env.example`.
3. Run the app with `npm run dev` and verify your change in the desktop workflow.
4. Run the quality checks:

   ```bash
   npm run test
   npm run typecheck
   npm run lint
   ```

### Contribution guidelines

- Keep IPC contracts in `src/shared/ipc.ts` and `src/shared/types.ts` in sync with preload and handler changes.
- For native Electron dependencies, keep Electron ABI rebuild requirements in mind.
- Prefer small, reviewable pull requests with clear commit messages.
- Do not add cloud, auth, or team features unless the work is explicitly requested.
- Preserve the local-only data model unless the product direction changes.

### Useful areas to inspect before changing behavior

- `src/main/services/` for execution, AI, persistence, and configuration logic
- `src/main/ipc/` for renderer-to-main contracts
- `src/renderer/src/app/components/` and `src/renderer/src/app/hooks/` for user workflows

## Maintainer notes

Windows releases use `electron-builder` and GitHub Releases.

- Set `GH_TOKEN` before running `npm run publish:win`.
- The publish target is the `TomasNiDo/qa-assistant` GitHub repository.
