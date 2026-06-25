# Workflow + HITL Plan

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

Migration requirements:

- Create new tables with `CREATE TABLE IF NOT EXISTS`.
- Create indexes with `CREATE INDEX IF NOT EXISTS`.
- Keep current `tasks` and `tasks_conversation` intact.
- Never require dropping or recreating the existing database file.

## Engine

### Phase 1

- Load workflow by `workflowId`
- Create a workflow run
- Execute sequential `agent` steps
- Pause on `human-input` and `human-approval`
- Persist run state after each step
- Return a task status of `waiting_for_human` for paused runs

### Phase 2

- Resume paused runs
- Resolve `subworkflow` steps
- Support richer bindings and conditional branching
- Add retry policies and approval rules per step

## API

Phase 1 endpoints:

- `GET /api/workflows`
- `GET /api/workflows/:id`
- `POST /api/workflows`
- `PUT /api/workflows/:id`
- `GET /api/workflow-runs/:id`
- `GET /api/human-tasks`
- `POST /api/human-tasks/:id/respond`

## UI

Phase 1 UI goals:

- Workflow list/detail
- Run detail with step timeline
- Human task inbox
- Read-only workflow graph first

Later:

- visual workflow editor
- nested workflow picker
- drag/drop step authoring

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
