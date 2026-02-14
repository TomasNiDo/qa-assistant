# QA Assistant (MVP Foundation)

Desktop QA helper built with Electron + React + TypeScript.

Current implementation includes:
- Local project/test CRUD with SQLite migrations.
- Step parser with strict grammar and natural-language fallback.
- Typed IPC layer between renderer and Electron main process.
- AI step generation and bug report drafting wired for Gemini Flash 2.5.
- Run lifecycle API with immediate cancel behavior (synthetic execution placeholder).

## Stack
- Electron + electron-vite
- React 18
- SQLite (better-sqlite3)
- Gemini API (`gemini-2.5-flash`)

## Quick Start
1. Install dependencies:
   - `npm install`
2. Configure env:
   - `cp .env.example .env`
   - add `GEMINI_API_KEY`
3. Start app:
   - `npm run dev`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`

## Data Locations
- DB: `app.getPath('userData')/qa-assistant/db.sqlite`
- Artifacts: `app.getPath('userData')/qa-assistant/artifacts`

## Notes
- `run.start` currently uses a synthetic runner loop while Playwright integration is pending.
- Bug reports are restricted to failed runs.
- PII masking is intentionally removed from MVP scope for personal-use iteration.
