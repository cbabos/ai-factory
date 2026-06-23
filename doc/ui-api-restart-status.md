# UI/API Restart Status

Last updated: 2026-06-23

## Goal

Restart the UI shell and API integration cleanly while preserving the reusable theme/component work already generated in `src/ui`.

## Plan

- [x] Preserve the generated state in a snapshot commit on `main`
- [x] Create a dedicated restart branch
- [x] Isolate the nested UI package from root lint/typecheck noise
- [x] Make the local `src/ui` package lint/typecheck against its real files
- [x] Replace the hash-based app shell with real React Router routes
- [x] Introduce shared UI-facing API DTOs/client helpers
- [x] Rewire `Agents`, `Models`, and `Tasks` pages to the shared client layer
- [x] Add task detail viewing and conversation rendering
- [ ] Align backend API DTOs with the UI contract
- [ ] Finish backend runtime wiring for editable entities
- [ ] Serve the built UI from the factory runtime
- [ ] Restore trustworthy UI tests around the rebuilt shell and client layer

## Current Status

### Completed

- Snapshot commit created on `main`: `a1e5e29`
- Working branch created: `codex/ui-api-restart`
- Root TypeScript/ESLint/Vitest configs now ignore the nested UI package
- `src/ui` has its own `.gitignore`, ESLint config, TypeScript scope, and Vitest include/exclude rules
- Local UI package checks currently pass:
  - `cd src/ui && npm run typecheck`
  - `cd src/ui && npm run lint`

### In Progress

- Aligning backend API DTOs with the UI contract so the frontend no longer needs endpoint-specific payload transforms
- Planning the next pass on task detail rendering, including markdown/HTML conversation rendering and subtask drill-down

### Known Gaps

- Root repo lint still has pre-existing non-UI failures in the core/api work
- The factory still loads `factory.config.json` for runtime entities
- Task detail/subtask browsing is still incomplete
- Task conversations are currently shown as plain text, not rendered markdown/HTML yet
- Static serving of the built UI is not wired into the runtime yet
