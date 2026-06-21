import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryTaskRepository } from "../task-repository.js";
import { SQLiteTaskRepository } from "../sqlite-task-repository.js";
import type { Task, FinalResult } from "../types.js";

function makeTask(id: string): Task {
  return {
    id,
    description: "test",
    context: {},
    origin: { channel: "cron", replyTo: "", messageId: "", rawPayload: {} },
    priority: "normal",
    createdAt: Date.now(),
  };
}

function makeResult(taskId: string): FinalResult {
  return {
    taskId,
    output: "done",
    success: true,
    subResults: [],
    totalTokens: { input: 10, output: 10, total: 20 },
    totalCost: 0,
    totalLatencyMs: 100,
    modelBreakdown: {},
  };
}

describe("InMemoryTaskRepository", () => {
  it("saves tasks and results", async () => {
    const repo = new InMemoryTaskRepository();
    const task = makeTask("t1");
    await repo.saveTask(task);
    await repo.saveResult("t1", makeResult("t1"), "completed");
    const record = await repo.get("t1");
    expect(record?.status).toBe("completed");
    expect(record?.result?.output).toBe("done");
  });
});

describe("SQLiteTaskRepository", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "task-repo-"));
    dbPath = join(tmpDir, "tasks.db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves tasks and results to sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    const task = makeTask("t2");
    await repo.saveTask(task);
    await repo.saveResult("t2", makeResult("t2"), "completed");
    const record = await repo.get("t2");
    expect(record?.status).toBe("completed");
    expect(record?.result?.output).toBe("done");
    repo.close();
  });

  it("returns all records ordered by updated_at desc", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("a"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await repo.saveTask(makeTask("b"));
    const all = await repo.getAll();
    expect(all.map((r: { id: string }) => r.id)).toEqual(["b", "a"]);
    repo.close();
  });
});
