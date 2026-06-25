import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
    await repo.appendConversation("t1", conversation);
    const record = await repo.get("t1");
    expect(record?.conversation).toEqual(conversation);
  });

  it("updates task status independently from conversation", async () => {
    const repo = new InMemoryTaskRepository();
    await repo.saveTask(makeTask("t1"));
    await repo.setStatus("t1", "running");
    const record = await repo.get("t1");
    expect(record?.status).toBe("running");
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
    await repo.close();
  });

  it("returns all records ordered by updated_at desc", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("a"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await repo.saveTask(makeTask("b"));
    const all = await repo.getAll();
    expect(all.map((r: { id: string }) => r.id)).toEqual(["b", "a"]);
    await repo.close();
  });

  it("saves conversation with result to sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("t3"));
    const conversation = makeConversation("t3");
    await repo.saveResult("t3", makeResult("t3"), "completed", conversation);
    const record = await repo.get("t3");
    expect(record?.conversation).toEqual(conversation);
    await repo.close();
  });

  it("saves conversation incrementally to sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("t3"));
    const conversation = makeConversation("t3");
    await repo.appendConversation("t3", conversation);
    const record = await repo.get("t3");
    expect(record?.conversation).toEqual(conversation);
    await repo.close();
  });

  it("updates task status independently in sqlite", async () => {
    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    await repo.saveTask(makeTask("t4"));
    await repo.setStatus("t4", "running");
    const record = await repo.get("t4");
    expect(record?.status).toBe("running");
    await repo.close();
  });

  it("migrates legacy row-level conversation data in place", async () => {
    const db = new DatabaseSync(dbPath);
    db.exec(
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        result TEXT,
        status TEXT NOT NULL,
        conversation TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );

    const task = makeTask("legacy-task");
    const conversation = makeConversation("legacy-task");
    db.prepare(
      `INSERT INTO tasks (id, task, result, status, conversation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      task.id,
      JSON.stringify(task),
      null,
      "completed",
      JSON.stringify(conversation),
      task.createdAt,
      task.createdAt,
    );
    db.close();

    const repo = new SQLiteTaskRepository(dbPath, "tasks");
    const migratedConversation = await repo.getConversation("legacy-task");
    expect(migratedConversation).toEqual(conversation);

    const migratedDb = new DatabaseSync(dbPath);
    const row = migratedDb
      .prepare("SELECT COUNT(*) AS count FROM tasks_conversation WHERE task_id = ?")
      .get("legacy-task") as { count: number };
    expect(row.count).toBe(conversation.length);
    migratedDb.close();
    await repo.close();
  });
});
