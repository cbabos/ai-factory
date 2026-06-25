# Workflow + HITL Status

## Status

Implemented in the current branch/runtime:

- versioned workflow definitions in SQLite
- workflow runs with resumable step state
- human task inbox and resume flow
- workflow editor and graph UI
- approval reroute handling (`approved`, `rejected`, `changes_requested`)
- task-scoped workflow artifacts stored on disk and indexed in SQLite
- artifact visibility in task details, workflow runs, and human task review screens
- questionnaire-capable human-input steps
- seeded `requirements-clarify-and-approve@2` workflow that emits:
  - structured markdown draft/final documents
  - machine-readable `openQuestions`
  - questionnaire-mode clarification prompts derived from workflow context

Still pending:

- project-level grouping across multiple tasks/runs/artifacts
- richer artifact previews/download UX
- stronger structured answer validation/completeness rules
- broader automated UI coverage around workflow editor and artifact flows

## Goal

Add deterministic, reusable workflow execution alongside the existing adaptive orchestrator, with first-class human-in-the-loop pauses, approvals, and resumptions.

## Principles

- Preserve the current adaptive path for tasks that do not opt into workflows.
- Store workflow definitions, workflow runs, and human tasks as first-class records.
- Use additive, in-place SQLite migrations only. Do not destroy or replace the current `ai-factory.db`.
- Treat reusable subworkflows as a core capability, not an add-on.
- Represent human checkpoints as structured workflow state, not only as chat text.

## Execution Modes

- `adaptive`: current estimate → decompose → dispatch → aggregate flow.
- `workflow`: deterministic execution of a stored workflow definition.

Tasks should be able to select a workflow explicitly, while all existing tasks continue to use adaptive orchestration by default.

## Domain Model

### Workflow Definition

- `id`
- `name`
- `version`
- `status`: `draft | active | archived`
- `description`
- `steps`
- `metadata`
- `createdAt`
- `updatedAt`

### Workflow Step Types

- `agent`: execute a named agent with explicit deterministic instructions
- `human-input`: pause and request clarification
- `human-approval`: pause for approval/reject/request-changes
- `subworkflow`: execute another workflow by id/version

Initial implementation can execute steps sequentially. DAG branching can be layered in once the core model is stable.

### Workflow Run

- `id`
- `workflowId`
- `workflowVersion`
- `taskId`
- `status`: `pending | running | waiting_for_human | completed | failed | cancelled`
- `currentStepId`
- `context`
- `stepStates`
- `createdAt`
- `updatedAt`
- `completedAt`

### Human Task

- `id`
- `workflowRunId`
- `workflowId`
- `stepId`
- `type`: `question | approval | review`
- `status`: `pending | answered | approved | rejected | changes_requested | cancelled`
- `title`
- `prompt`
- `response`
- `assignedTo`
- `createdAt`
- `updatedAt`
- `resolvedAt`

## Persistence

Additive SQLite tables:

- `workflows`
- `workflow_runs`
- `human_tasks`
- `workflow_artifacts`

Migration requirements:

- Create new tables with `CREATE TABLE IF NOT EXISTS`.
- Create indexes with `CREATE INDEX IF NOT EXISTS`.
- Keep current `tasks` and `tasks_conversation` intact.
- Never require dropping or recreating the existing database file.

## Engine

### Implemented

- Load workflow by `workflowId`
- Create and persist workflow runs
- Execute sequential `agent` steps
- Pause on `human-input` and `human-approval`
- Resume paused runs
- Persist run state after each step
- Handle approval reroutes and fail paths
- Persist task-scoped artifacts from long-form agent output
- Derive questionnaire fields from workflow context open-question payloads

### Next

- richer bindings and conditional branching
- explicit output contracts per workflow step
- stronger validation around questionnaire answers
- richer artifact/reference insertion back into prompts

## API

Implemented endpoints:

- `GET /api/workflows`
- `GET /api/workflows/:id`
- `POST /api/workflows`
- `PUT /api/workflows/:id`
- `GET /api/workflow-runs/:id`
- `GET /api/human-tasks`
- `POST /api/human-tasks/:id/respond`
- `GET /api/artifacts`
- `GET /api/artifacts/:id`
- `GET /api/artifacts/:id/content`

## UI

Implemented UI:

- workflow list/detail editor
- graph-based step editing
- run detail with step timeline
- human task inbox
- structured prompt/context reader
- artifact visibility across review surfaces

Later:

- richer artifact previews and downloads
- project-aware artifact/task grouping
- deeper editor ergonomics and validation

## Routing

Task routing rules:

- if task references a `workflowId`, route to workflow execution
- otherwise use the current adaptive orchestrator

This preserves backward compatibility and allows progressive adoption.

## Testing

- workflow repository persistence
- in-place SQLite migration behavior
- sequential workflow execution
- pause on HITL steps
- task routing between adaptive and workflow modes

## Delivery Order

1. Domain types and repository interfaces
2. SQLite stores and migration-safe schema creation
3. Minimal workflow engine
4. Factory routing
5. API surface
6. UI surface
7. Resume/response flow for human tasks
