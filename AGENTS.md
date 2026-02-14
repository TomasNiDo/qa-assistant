# AGENTS.md

## Project
- Name: `qa-assistant`
- Type: Electron + React desktop app
- Purpose: Local AI-powered QA assistant for creating/running step-based tests and drafting bug reports.

## Current MVP Decisions
- AI provider/model: `gemini-2.5-flash`
- Step parsing: strict grammar + natural-language fallback
- Run cancellation: immediate cancel when requested
- PII masking: deferred (not in MVP)

## Tech Stack
- Electron + `electron-vite`
- React + TypeScript
- SQLite via `better-sqlite3`
- AI via Gemini API

## Key Paths
- Main process: `src/main/`
- Preload bridge: `src/preload/index.ts`
- Renderer app: `src/renderer/src/`
- Shared contracts: `src/shared/`
- DB migration: `src/main/db/migrations/001_initial.sql`
- Electron/Vite config: `electron.vite.config.ts`

## Setup
1. Install dependencies: `npm install`
2. Configure env: copy `.env.example` to `.env`
3. Add `GEMINI_API_KEY` to `.env`
4. Start dev app: `npm run dev`

## Useful Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Agent Working Rules
- Keep IPC contracts in `src/shared/ipc.ts` and `src/shared/types.ts` in sync with handler and preload changes.
- For native Electron dependencies, ensure they are externalized and rebuilt for Electron ABI.
- Prefer small, focused commits with clear messages.
- Do not add cloud/auth/team features in MVP unless explicitly requested.
- Maintain local-only data assumptions and SQLite-first implementation.

## Next Major Work Items
- Replace synthetic run loop in `RunService` with real Playwright execution.
- Persist real screenshot artifacts per step.
- Add run live updates from main to renderer (status/timeline improvements).
- Harden AI validation and destructive-action confirmation UX.
