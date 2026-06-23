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
- [x] Align backend API DTOs with the UI contract
- [x] Add live task polling and markdown conversation rendering
- [x] Finish backend runtime wiring for editable entities
- [x] Serve the built UI from the factory runtime
- [x] Restore trustworthy UI tests around the rebuilt shell and client layer

## Current Status

### Completed

- Snapshot commit created on `main`: `a1e5e29`
- Working branch created: `codex/ui-api-restart`
- Root TypeScript/ESLint/Vitest configs now ignore the nested UI package
- `src/ui` has its own `.gitignore`, ESLint config, TypeScript scope, and Vitest include/exclude rules
- Local UI package checks currently pass:
  - `cd src/ui && npm run typecheck`
  - `cd src/ui && npm run lint`
- Backend task/agent wiring now reaches the API server through initialized stores/repositories
- Runtime startup now seeds persisted agent/model records from config and prefers the editable stores on boot
- API runtime now serves the built `src/ui/dist` bundle when it exists and falls back to `index.html` for client routes
- Vitest now targets a smaller trusted UI contract suite focused on theme config, route contracts, and shared API client behavior
- Models UI now reads provider choices from runtime model data and constrains model IDs to the selected provider's discovered/configured catalog
- Runtime model discovery now persists newly discovered models into the editable model store for UI consumption
- Models screen now uses a table-first management view so provider, model ID, costs, capabilities, source, and status are visible at a glance
- Agents CRUD form now generates IDs from names, uses runtime model choices, removes derived/noisy fields, and exposes prompt/config metadata in a concise editor

### In Progress

- Planning the next pass on task detail UX, especially subtask drill-down and richer thread metadata

### Known Gaps

- Root repo lint still has pre-existing non-UI failures in the core/api work
- The factory still loads `factory.config.json` as the bootstrap seed for persisted entities and provider setup
- Task detail/subtask browsing is still incomplete
- Agent prompt/config metadata is persisted by the UI/API but is not yet consumed by runtime agent execution
- The runtime only serves the UI after `src/ui` has been built to `src/ui/dist`
- Legacy generated component/page tests remain out of scope until they are rewritten against the actual rendered UI contracts
