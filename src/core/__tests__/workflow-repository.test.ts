import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InMemoryWorkflowArtifactRepository,
  InMemoryHumanTaskRepository,
  InMemoryWorkflowRepository,
  InMemoryWorkflowRunRepository,
} from "../workflow-repository.js";
import {
  SQLiteWorkflowArtifactRepository,
  SQLiteHumanTaskRepository,
  SQLiteWorkflowRepository,
  SQLiteWorkflowRunRepository,
} from "../sqlite-workflow-repository.js";
import type {
  HumanTaskRecord,
  WorkflowArtifactRecord,
  WorkflowDefinition,
  WorkflowRun,
} from "../workflow-types.js";

function makeWorkflow(version = 1, status: WorkflowDefinition["status"] = "active"): WorkflowDefinition {
  return {
    id: "requirements-flow",
    name: "Requirements Flow",
    version,
    status,
    description: "Collect and review requirements",
    steps: [],
    createdAt: 1,
    updatedAt: version,
  };
}

function makeRun(status: WorkflowRun["status"] = "running"): WorkflowRun {
  return {
    id: "run-1",
    workflowId: "requirements-flow",
    workflowVersion: 1,
    taskId: "task-1",
    status,
    currentStepId: "step-1",
    context: {},
    stepStates: {},
    createdAt: 1,
    updatedAt: 2,
  };
}

function makeHumanTask(status: HumanTaskRecord["status"] = "pending"): HumanTaskRecord {
  return {
    id: "human-1",
    workflowRunId: "run-1",
    workflowId: "requirements-flow",
    workflowVersion: 1,
    stepId: "question-1",
    type: "question",
    status,
    title: "Clarify requirement",
    prompt: "Which environment should this deploy to?",
    createdAt: 1,
    updatedAt: 2,
  };
}

function makeArtifact(): WorkflowArtifactRecord {
  return {
    id: "artifact-1",
    taskId: "task-1",
    workflowRunId: "run-1",
    stepId: "draft",
    title: "Draft Requirements",
    kind: "markdown",
    mimeType: "text/markdown; charset=utf-8",
    fileName: "draft-requirements.md",
    storagePath: "/tmp/draft-requirements.md",
    sizeBytes: 128,
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("Workflow repositories", () => {
  it("returns the active latest workflow from memory", async () => {
    const repo = new InMemoryWorkflowRepository();
    await repo.save(makeWorkflow(1, "draft"));
    await repo.save(makeWorkflow(2, "active"));
    const workflow = await repo.get("requirements-flow");
    expect(workflow?.version).toBe(2);
  });

  it("stores runs and human tasks in memory", async () => {
    const runRepo = new InMemoryWorkflowRunRepository();
    const humanRepo = new InMemoryHumanTaskRepository();
    const artifactRepo = new InMemoryWorkflowArtifactRepository();
    await runRepo.save(makeRun("waiting_for_human"));
    await humanRepo.save(makeHumanTask());
    await artifactRepo.save(makeArtifact());
    expect((await runRepo.getByTaskId("task-1"))?.status).toBe("waiting_for_human");
    expect(await humanRepo.listPending()).toHaveLength(1);
    expect(await artifactRepo.getByWorkflowRun("run-1")).toHaveLength(1);
  });
});

describe("SQLite workflow repositories", () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "workflow-repo-"));
    dbPath = join(dir, "ai-factory.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists workflows, runs, and human tasks non-destructively", async () => {
    const workflowRepo = new SQLiteWorkflowRepository(dbPath);
    const runRepo = new SQLiteWorkflowRunRepository(dbPath);
    const humanRepo = new SQLiteHumanTaskRepository(dbPath);
    const artifactRepo = new SQLiteWorkflowArtifactRepository(dbPath);

    await workflowRepo.save(makeWorkflow());
    await runRepo.save(makeRun("waiting_for_human"));
    await humanRepo.save(makeHumanTask());
    await artifactRepo.save(makeArtifact());

    expect((await workflowRepo.get("requirements-flow"))?.name).toBe("Requirements Flow");
    expect((await runRepo.getByTaskId("task-1"))?.status).toBe("waiting_for_human");
    expect(await humanRepo.listPending()).toHaveLength(1);
    expect(await artifactRepo.getByTaskId("task-1")).toHaveLength(1);

    await workflowRepo.close();
    await runRepo.close();
    await humanRepo.close();
    await artifactRepo.close();
  });
});
