# Phase 001 — Scaffolding and Core Architecture

## Goals
- Establish the Electron + React app shell and IPC foundations.
- Define the directory structure and development workflow.

## Tasks
- [x] Initialize the repository and project structure.
  - [x] Choose the repo layout (apps/desktop, packages/shared).
  - [x] Add README and .gitignore.
  - [x] Set the Node version (.nvmrc or .node-version).
- [x] Set up Electron main and renderer processes.
  - [x] Create main process entry and preload bridge.
  - [x] Create renderer entry and bundler config.
  - [x] Wire window creation and app lifecycle.
- [x] Add React UI shell with basic navigation layout.
  - [x] Install React and router.
  - [x] Build base layout (sidebar/topbar).
  - [x] Add placeholder screens (Projects, Tests, Runs).
- [x] Establish IPC channels and a typed IPC contract layer.
  - [x] Define IPC channel constants.
  - [x] Implement safe API in preload (contextBridge).
  - [x] Add renderer client wrappers.
- [x] Define app data directory and config paths.
  - [x] Resolve OS-specific app data path.
  - [x] Create directories on first run.
  - [x] Add config read/write helpers.
- [x] Configure build tooling, linting, and formatting.
  - [x] Add ESLint and Prettier configs.
  - [x] Add typecheck script.
  - [x] Add build/dev scripts.
- [x] Add a minimal sample screen to confirm end-to-end wiring.
  - [x] Create a "Hello" screen.
  - [x] Verify IPC roundtrip.
  - [x] Smoke run dev build.
