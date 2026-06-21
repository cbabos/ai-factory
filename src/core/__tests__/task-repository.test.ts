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

function makeConversation(taskId: string) {
  return [
    { role: "system", content: "sys", timestamp: 1 },
    { role: "user", content: `task ${taskId}`, timestamp: 2 },
    { role: "model", content: "ok", timestamp: 3 },
  ] as import("../types.js").ConversationTurn[];
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

  it("saves conversation with result", async () => {
    const repo = new InMemoryTaskRepository();
    await repo.saveTask(makeTask("t1"));
    const conversation = makeConversation("t1");
    await repo.saveResult("t1", makeResult("t1"), "completed", conversation);
    const record = await repo.get("t1");
    expect(record?.conversation).toEqual(conversation);
  });

  it("saves conversation incrementally", async () => {
    const repo = new InMemoryTaskRepository();
    await repo.saveTask(makeTask("t1"));
    const conversation = makeConversation("t1");
    await repo.saveConversation("t1", conversation);
    const record = await repo.get("t1");
    expect(record?.conversation).toEqual(conversation);
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

  it("saves conversation with result to sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("t3"));
    const conversation = makeConversation("t3");
    await repo.saveResult("t3", makeResult("t3"), "completed", conversation);
    const record = await repo.get("t3");
    expect(record?.conversation).toEqual(conversation);
    repo.close();
  });

  it("saves conversation incrementally to sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("t3"));
    const conversation = makeConversation("t3");
    await repo.saveConversation("t3", conversation);
    const record = await repo.get("t3");
    expect(record?.conversation).toEqual(conversation);
    repo.close();
  });
});
