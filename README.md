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
- `npm run dist:win` (build Windows `.exe` installer locally)
- `npm run publish:win` (build + publish Windows release artifacts)
- `npm run preview`
- `npm run seed:sample`
- `npm run test`
- `npm run typecheck`
- `npm run lint`

## Release Notes (Windows)
- App version is sourced from `package.json` (`version` field).
- Current version: `0.1.0-beta.1`
- Auto-update uses `electron-updater` + GitHub Releases.
- To publish updates, set `GH_TOKEN` before running `npm run publish:win`.

### Setting `GH_TOKEN` for Publish
1. Create a GitHub personal access token for the account that can publish to this repo.
2. Grant repo write access for `TomasNiDo/qa-assistant`.
3. Set the token in your shell only for the current session:
   - PowerShell:
     - ``$env:GH_TOKEN="your_token_here"``
   - CMD:
     - ``set GH_TOKEN=your_token_here``
4. Publish:
   - ``npm run publish:win``
5. Optional cleanup after publish:
   - PowerShell:
     - ``Remove-Item Env:GH_TOKEN``
   - CMD:
     - ``set GH_TOKEN=``

### CI (GitHub Actions)
- Add repository secret named `GH_TOKEN`.
- Map it in workflow env for the publish step:
  - ``env: GH_TOKEN: ${{ secrets.GH_TOKEN }}``

## Data Locations
- DB: `app.getPath('userData')/qa-assistant/db.sqlite`
- Artifacts: `app.getPath('userData')/qa-assistant/artifacts`

## Notes
- `run.start` currently uses a synthetic runner loop while Playwright integration is pending.
- Bug reports are restricted to failed runs.
- PII masking is intentionally removed from MVP scope for personal-use iteration.
