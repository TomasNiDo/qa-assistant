## 1. Shared Contracts And IPC Surface

- [x] 1.1 Add `generateFeatureScenarios` channel and request/response typings in `src/shared/ipc.ts` and `src/shared/types.ts`.
- [x] 1.2 Expose a typed preload bridge method for `generateFeatureScenarios(featureId)` and keep bridge types synchronized.
- [x] 1.3 Add input guards for `featureId` and standardized success/failure response envelope types.

## 2. Main-Process AI Generation Modules

- [x] 2.1 Add a prompt-builder utility that produces strict JSON-only instructions from feature title, project, and acceptance criteria.
- [x] 2.2 Add Gemini client utility in main process with timeout handling and API-key presence checks.
- [x] 2.3 Add response parser/validator that enforces JSON shape, enum constraints, title sanitization, deduplication, and max-20 cap.

## 3. Persistence And Handler Orchestration

- [x] 3.1 Implement `ipcMain.handle("generateFeatureScenarios", ...)` flow: fetch feature context, call AI utility, validate, insert, and return typed result.
- [x] 3.2 Insert valid scenarios as planning drafts with AI provenance flags (`isAiGenerated=true`, `editedByUser=false`) and drafted triage state.
- [x] 3.3 Ensure generation never auto-approves or auto-creates execution-ready test cases.

## 4. Planning UI Integration

- [x] 4.1 Add `Generate Scenarios (AI)` button to Feature Planning mode and wire click handler to preload API.
- [x] 4.2 Implement loading/disabled behavior while generation request is in flight and prevent concurrent requests.
- [x] 4.3 On success, append inserted scenarios to drafted list, show count toast, and re-enable action.
- [x] 4.4 On failure, show non-blocking error notification with returned message and preserve existing drafts.
- [x] 4.5 Add subtle AI badge rendering for drafted rows where `isAiGenerated` is true.

## 5. Regeneration And Safety Behavior

- [x] 5.1 Keep MVP regenerate behavior append-only so manually authored drafts are never deleted.
- [x] 5.2 Ensure repeated generation dedupes within each AI response before insert and handles empty-valid-result cases safely.

## 6. Verification

- [x] 6.1 Add unit tests for prompt rules, JSON parsing failures, enum/title validation, deduplication, and max-limit enforcement.
- [x] 6.2 Add IPC/service tests for success, missing API key, timeout, malformed output, and empty-response error paths.
- [x] 6.3 Add renderer tests for button loading states, success append behavior, error notifications, and AI badge display.
- [x] 6.4 Run `npm run typecheck` and `npm run lint` and resolve all new issues introduced by this change.
