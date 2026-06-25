import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { WorkflowEngine } from "../workflow-engine.js";
import { EventBus } from "../event-bus.js";
import { Tracer } from "../tracer.js";
import { BudgetTracker } from "../budget-tracker.js";
import {
  InMemoryWorkflowArtifactRepository,
  InMemoryHumanTaskRepository,
  InMemoryWorkflowRepository,
  InMemoryWorkflowRunRepository,
} from "../workflow-repository.js";
import type { IAgent, IModelSelector } from "../interfaces.js";
import type { AgentManifest, ModelChoice, Task, TaskResult } from "../types.js";
import type { WorkflowDefinition } from "../workflow-types.js";

function makeTask(): Task {
  return {
    id: "task-1",
    description: "Write requirements for the release",
    context: { repo: "ai-factory" },
    origin: { channel: "api", replyTo: "", messageId: "", rawPayload: {} },
    priority: "normal",
    createdAt: Date.now(),
    workflow: { workflowId: "requirements-flow", workflowVersion: 1 },
  };
}

function makeManifest(id: string): AgentManifest {
  return {
    id,
    tags: ["analysis"],
    complexityRange: [1, 5],
    tokenProfile: { min: 50, max: 500, typical: 150 },
    timeoutMs: 30000,
    maxRetries: 1,
  };
}

function makeAgent(id: string): IAgent {
  const result: TaskResult = {
    subTaskId: "sub-1",
    output: { ok: true },
    success: true,
    actualTokens: { input: 10, output: 20, total: 30 },
    actualCost: 0.01,
    modelUsed: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      estimatedTokens: { min: 10, max: 100, expected: 50 },
      estimatedCost: 0.01,
    },
    latencyMs: 10,
    retries: 0,
    conversation: [{ role: "model", content: "Requirements drafted", timestamp: 2 }],
  };

  return {
    name: id,
    manifest: makeManifest(id),
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as IAgent;
}

function makeSelector(): IModelSelector {
  const choice: ModelChoice = {
    provider: "openai",
    modelId: "gpt-4o-mini",
    estimatedTokens: { min: 10, max: 100, expected: 50 },
    estimatedCost: 0.01,
  };

  return {
    select: vi.fn().mockResolvedValue(choice),
  };
}

function makeWorkflow(steps: WorkflowDefinition["steps"]): WorkflowDefinition {
  return {
    id: "requirements-flow",
    name: "Requirements Flow",
    version: 1,
    status: "active",
    steps,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("WorkflowEngine", () => {
  it("executes deterministic agent workflow steps", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const agent = makeAgent("analysis-agent");
    await workflowRepo.save(makeWorkflow([
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}}",
        outputKey: "requirements",
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const appended: string[] = [];
    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
      onConversationAppended: async (_taskId, conversation) => {
        appended.push(...conversation.map((turn) => turn.content));
      },
    });

    const result = await engine.execute(makeTask());
    expect(result.success).toBe(true);
    expect(result.subResults).toHaveLength(1);
    expect((result.output as { context: Record<string, unknown> }).context.requirements).toEqual({ ok: true });
    expect((await runRepo.getAll())[0]?.status).toBe("completed");
    expect(appended.length).toBeGreaterThan(0);
  });

  it("pauses on HITL steps and creates a pending human task", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    await workflowRepo.save(makeWorkflow([
      {
        id: "clarify",
        name: "Clarify release target",
        type: "human-input",
        prompt: "Which environment should {{task.description}} target?",
        outputKey: "environment",
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      agents: new Map(),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    const result = await engine.execute(makeTask());
    expect(result.success).toBe(false);
    expect(result.output).toMatchObject({ waitingForHuman: true });
    expect((await humanRepo.listPending())[0]?.status).toBe("pending");
    expect((await runRepo.getAll())[0]?.status).toBe("waiting_for_human");
  });

  it("derives questionnaire fields from prior workflow context open questions", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const artifactRepo = new InMemoryWorkflowArtifactRepository();
    const agent = makeAgent("analysis-agent");
    vi.mocked(agent.execute).mockResolvedValueOnce({
      subTaskId: "sub-1",
      output: {
        document: {
          title: "Draft Requirements",
          format: "markdown",
          content: "# Draft Requirements\n\nThis is a draft.\n".repeat(30),
        },
        summary: "Initial draft ready",
        openQuestions: [
          { id: "pricing-model", question: "What pricing model is required?", rationale: "Needed for product catalog scope." },
          { id: "launch-region", question: "Which launch region should be supported first?" },
        ],
      },
      success: true,
      actualTokens: { input: 10, output: 20, total: 30 },
      actualCost: 0.01,
      modelUsed: {
        provider: "openai",
        modelId: "gpt-4o-mini",
        estimatedTokens: { min: 10, max: 100, expected: 50 },
        estimatedCost: 0.01,
      },
      latencyMs: 10,
      retries: 0,
    });

    await workflowRepo.save(makeWorkflow([
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}}",
        outputKey: "draftRequirements",
      },
      {
        id: "clarify",
        name: "Clarify open questions",
        type: "human-input",
        prompt: "Answer the open questions for {{task.description}} using {{workflow.context}}",
        outputKey: "clarifications",
        promptMode: "questionnaire",
        dependsOn: ["draft"],
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      artifactRepository: artifactRepo,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    await engine.execute(makeTask());
    const pendingTask = (await humanRepo.listPending())[0];
    expect(pendingTask?.promptMode).toBe("questionnaire");
    expect(pendingTask?.questions?.map((question) => question.id)).toEqual([
      "pricing-model",
      "launch-region",
    ]);
  });

  it("resumes a paused HITL workflow after human response", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const agent = makeAgent("analysis-agent");
    await workflowRepo.save(makeWorkflow([
      {
        id: "clarify",
        name: "Clarify release target",
        type: "human-input",
        prompt: "Which environment should {{task.description}} target?",
        outputKey: "environment",
      },
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}} in {{workflow.context}}",
        outputKey: "requirements",
        dependsOn: ["clarify"],
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    await engine.execute(makeTask());
    const pendingTask = (await humanRepo.listPending())[0];
    expect(pendingTask).toBeDefined();

    const result = await engine.resumeHumanTask(pendingTask!.id, "production");
    expect(result.success).toBe(true);
    expect((result.output as { context: Record<string, unknown> }).context.environment).toBe("production");
    expect((await humanRepo.get(pendingTask!.id))?.status).toBe("answered");
    expect((await runRepo.getAll())[0]?.status).toBe("completed");
  });

  it("reroutes approval steps back to rework when changes are requested", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const agent = makeAgent("analysis-agent");

    await workflowRepo.save(makeWorkflow([
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}} using {{workflow.context}}",
        outputKey: "requirements",
      },
      {
        id: "review",
        name: "Review output",
        type: "human-approval",
        prompt: "Review current output for {{task.description}}",
        outputKey: "reviewDecision",
        onChangesRequested: "draft",
        onRejected: "fail",
        dependsOn: ["draft"],
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    await engine.execute(makeTask());
    const firstApproval = (await humanRepo.listPending())[0];
    expect(firstApproval).toBeDefined();

    const result = await engine.resumeHumanTask(firstApproval!.id, {
      decision: "changes_requested",
      notes: "Please fix the missing rollback section.",
    });

    expect(result.success).toBe(false);
    expect(result.output).toMatchObject({ waitingForHuman: true });
    expect(agent.execute).toHaveBeenCalledTimes(2);

    const run = (await runRepo.getAll())[0];
    expect(run?.status).toBe("waiting_for_human");
    expect(run?.context.reviewDecision).toMatchObject({
      decision: "changes_requested",
      notes: "Please fix the missing rollback section.",
    });

    const pendingTasks = await humanRepo.listPending();
    expect(pendingTasks).toHaveLength(1);
    expect(pendingTasks[0]?.id).not.toBe(firstApproval?.id);
  });

  it("fails the workflow when approval is rejected", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const agent = makeAgent("analysis-agent");

    await workflowRepo.save(makeWorkflow([
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}}",
        outputKey: "requirements",
      },
      {
        id: "review",
        name: "Review output",
        type: "human-approval",
        prompt: "Review current output for {{task.description}}",
        outputKey: "reviewDecision",
        onRejected: "fail",
        dependsOn: ["draft"],
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    await engine.execute(makeTask());
    const approvalTask = (await humanRepo.listPending())[0];
    expect(approvalTask).toBeDefined();

    const result = await engine.resumeHumanTask(approvalTask!.id, {
      decision: "rejected",
      notes: "Do not proceed with this release.",
    });

    expect(result.success).toBe(false);
    expect(result.output).toMatchObject({
      error: "Human approval rejected the workflow output.",
    });
    expect((await runRepo.getAll())[0]?.status).toBe("failed");
  });

  it("persists long-form agent outputs as artifacts", async () => {
    const workflowRepo = new InMemoryWorkflowRepository();
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const artifactRepo = new InMemoryWorkflowArtifactRepository();
    const dir = mkdtempSync(join(tmpdir(), "workflow-artifacts-"));
    const agent = makeAgent("analysis-agent");
    vi.mocked(agent.execute).mockResolvedValueOnce({
      subTaskId: "sub-1",
      output: {
        analysis: "# Draft Requirements\n\nThis is a saved requirements document.\n\n- Item one\n- Item two\n".repeat(20),
      },
      success: true,
      actualTokens: { input: 10, output: 20, total: 30 },
      actualCost: 0.01,
      modelUsed: {
        provider: "openai",
        modelId: "gpt-4o-mini",
        estimatedTokens: { min: 10, max: 100, expected: 50 },
        estimatedCost: 0.01,
      },
      latencyMs: 10,
      retries: 0,
    });

    await workflowRepo.save(makeWorkflow([
      {
        id: "draft",
        name: "Draft requirements",
        type: "agent",
        agentId: "analysis-agent",
        instruction: "Draft requirements for {{task.description}}",
        outputKey: "requirements",
      },
    ]));

    const eventBus = new EventBus();
    const tracer = new Tracer();
    const budgetTracker = new BudgetTracker(eventBus);
    budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    budgetTracker.initialize(["openai"]);

    const engine = new WorkflowEngine({
      workflowRepository: workflowRepo,
      workflowRunRepository: runRepo,
      humanTaskRepository: humanRepo,
      artifactRepository: artifactRepo,
      artifactRootDir: dir,
      agents: new Map([["analysis-agent", agent]]),
      modelSelector: makeSelector(),
      budgetTracker,
      eventBus,
      tracer,
    });

    await engine.execute(makeTask());

    const artifacts = await artifactRepo.getByTaskId("task-1");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.title).toContain("Draft requirements");
    expect(readFileSync(artifacts[0]!.storagePath, "utf8")).toContain("Draft Requirements");
    expect((await runRepo.getAll())[0]?.artifactIds).toEqual([artifacts[0]?.id]);

    rmSync(dir, { recursive: true, force: true });
  });
});
