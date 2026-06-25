# AI Factory — Next Steps

**Status:** the core workflow/HITL system is now implemented alongside the adaptive orchestrator. The main remaining work is refinement: artifact ergonomics, richer structured human input, and stronger project-level grouping.

## Current State Summary

- Adaptive orchestrator path remains intact for non-workflow tasks.
- Deterministic workflow execution is live with:
  - versioned workflow definitions
  - workflow runs
  - human task pause/resume flow
  - workflow editor UI
  - workflow graph view
  - run detail and human task inbox
  - task-scoped artifact persistence and review links
- Seeded workflow `requirements-clarify-and-approve@2` now emits:
  - markdown draft/final requirement documents as artifacts
  - structured open questions for human clarification
  - questionnaire-mode human tasks with bulk fallback

## What’s Complete

- Workflow runtime persistence in SQLite
- Workflow CRUD and run APIs
- Human task resume flow for approvals and clarifications
- Visual workflow editor and graph-based step authoring
- Artifact persistence plus UI surfacing in task, run, and human-task screens
- Structured questionnaire groundwork in workflow types, editor, engine, and inbox UI

## Next Priorities

1. Add true project-level grouping so related tasks, workflow runs, and artifacts can share a stable home.
2. Improve artifact ergonomics with richer previews, downloads, and clearer references inside prompts and approval screens.
3. Strengthen structured clarification generation and validation, including cleaner transformation of questionnaire answers back into workflow context.
4. Add targeted UI tests for workflow editor, Human Tasks, and artifact display paths.
5. Revisit the full test suite once the environment-dependent webhook/socket tests are isolated or mocked more safely.

## Notes

- `doc/workflow-hitl-plan.md` is the best source of truth for current workflow/HITL capabilities and remaining gaps.
- Full repo tests can still fail in sandboxed environments because the webhook sensor and responder tests require real socket binding.
