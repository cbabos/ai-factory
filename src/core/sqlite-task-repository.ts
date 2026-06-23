import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { Task, FinalResult, ConversationTurn } from "./types.js";
import type { ITaskRepository, TaskRecord } from "./task-repository.js";

export class SQLiteTaskRepository implements ITaskRepository {
  private readonly db: DatabaseSync;
  private readonly getStmt: StatementSync;
  private readonly getAllStmt: StatementSync;
  private readonly saveStmt: StatementSync;
  private readonly updateResultStmt: StatementSync;
  private readonly updateConversationStmt: StatementSync;

  constructor(path: string, tableName: string = "tasks") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        result TEXT,
        status TEXT NOT NULL,
        conversation TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );

    this.getStmt = this.db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
    this.getAllStmt = this.db.prepare(`SELECT * FROM ${tableName} ORDER BY updated_at DESC`);
    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName} (id, task, result, status, conversation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         task = excluded.task,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    );
    this.updateResultStmt = this.db.prepare(
      `UPDATE ${tableName} SET result = ?, status = ?, conversation = ?, updated_at = ? WHERE id = ?`,
    );
    this.updateConversationStmt = this.db.prepare(
      `UPDATE ${tableName} SET conversation = ?, updated_at = ? WHERE id = ?`,
    );
  }

  async saveTask(task: Task): Promise<void> {
    const now = Date.now();
    const existing = this.getStmt.get(task.id) as Record<string, unknown> | undefined;
    this.saveStmt.run(
      task.id,
      JSON.stringify(task),
      null,
      "pending",
      null,
      existing ? (existing.created_at as number) : now,
      now,
    );
  }

  async saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void> {
    this.updateResultStmt.run(JSON.stringify(result), status, conversation ? JSON.stringify(conversation) : null, Date.now(), taskId);
  }

  async saveConversation(taskId: string, conversation: ConversationTurn[]): Promise<void> {
    this.updateConversationStmt.run(JSON.stringify(conversation), Date.now(), taskId);
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    const row = this.getStmt.get(taskId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToRecord(row);
  }

  async getAll(): Promise<TaskRecord[]> {
    const rows = this.getAllStmt.all() as Record<string, unknown>[];
    return rows.map((row) => this.rowToRecord(row));
  }

  close(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }

  private rowToRecord(row: Record<string, unknown>): TaskRecord {
    return {
      id: row.id as string,
      task: JSON.parse(row.task as string) as Task,
      result: row.result ? (JSON.parse(row.result as string) as FinalResult) : undefined,
      status: row.status as TaskRecord["status"],
      conversation: row.conversation
        ? (JSON.parse(row.conversation as string) as ConversationTurn[])
        : undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
