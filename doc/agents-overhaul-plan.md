# Agents Overhaul Plan

## Goal

Clean up the Agents experience and gradually realign routing/model selection around capability tags, budget, and explainability instead of mixed heuristics and misleading agent-level controls.

## Principles

- Keep phase 1 focused on UI/API cleanup with minimal routing risk.
- Treat tags as first-class shared data before redesigning routing behavior around them.
- Use task complexity for decomposition decisions, not agent ranking.
- Keep model selection capability-driven and budget-aware.
- Prefer explainable, deterministic routing over hidden heuristics.

## Phase 1: Agents UI Cleanup

Scope:

- Normalize filter control heights on the Agents page.
- Set default filters to:
  - tags: all
  - complexity: all
  - status: active
- Remove `Preferred Models` from the Agents UI flow.
- Remove agent token profile fields from the Agent form and summary cards.
- Keep temporary backend compatibility by supplying a hidden/default token profile until the backend contract is simplified.
- Move `Output Contract` and `Tool Policy` to the end of the form, just before `Notes` and `Extra Metadata JSON`.
- Make `System Prompt` full width.
- Add helper text to `Output Contract` clarifying that it is prompt guidance only and is not automatically validated unless `metadata.outputMode = "json"` is also set.

Why this first:

- Low risk to runtime behavior.
- Removes the most misleading fields quickly.
- Creates a cleaner base for later tag/routing work.

## Phase 2: Tags as First-Class Data

Scope:

- Add tag CRUD in the database and API.
- Replace freeform comma-separated tag entry with DB-backed selectors.
- Use the same tag source across:
  - Agents
  - Models
  - workflow capability tags
  - decomposition prompts and validation
- Define tag naming rules and normalize existing values.

Dependencies:

- Phase 1 can ship before this.
- Phase 3 should not be finalized until shared tag data exists.

## Phase 3: Agent Routing Redesign

Scope:

- Use complexity only for decomposition decisions.
- Remove complexity from agent ranking.
- Replace exact tag-match routing with scored capability matching.
- Rank agents using:
  - task-tag coverage
  - task-side unmatched tags
  - agent-side unmatched tags
- Add deterministic tie-breakers.
- Define hard minimum acceptance rules so weak partial matches do not accidentally win.
- Return ranked candidates and capture routing rationale for debugging.
- Define fallback behavior when no candidate is good enough.

Open questions:

- Whether fallback should fail fast, use a designated generalist, or later trigger HITL.
- Whether agent-side unmatched tags should be a linear penalty or a small specialization penalty.

## Phase 4: Model Selection Cleanup

Scope:

- Remove agent-specific model preference noise from selection decisions.
- Select models based on:
  - capability fit
  - cost
  - available budget
  - later: reliability, latency, provider preference
- Recompute actual cost from actual input/output token usage and model pricing.
- Move output/token limiting responsibility to model/task/system policy rather than agent config.

Why separate:

- Model-selection cleanup depends on stable tag semantics.
- Cost accounting can be improved independently of routing.

## Phase 5: Observability and Future Subtasks

Scope:

- Add debug visibility showing:
  - subtask tags
  - ranked agent candidates
  - chosen agent
  - score breakdown
- Revisit decomposition prompts so generated `capabilityTags` are more consistent.
- Prepare subtasks as first-class records later so routing, HITL, and auditing can be visualized cleanly.

## Suggested Delivery Order

1. Phase 1: Agents UI cleanup
2. Phase 2: Tag CRUD and shared vocabulary
3. Phase 4a: Actual cost accounting fix
4. Phase 3: Agent routing redesign
5. Phase 4b: Full model-selection cleanup
6. Phase 5: Routing observability and first-class subtask groundwork

## Current First Slice

The implementation started in this pass should cover:

- Agents page filter defaults and sizing cleanup
- removal of preferred-model and token-profile noise from the Agents UI
- repositioning and clarification of `Output Contract` and `Tool Policy`
- preserving current backend compatibility while the wider API/data-model cleanup is still pending
