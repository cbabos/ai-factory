import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { Task, FinalResult, ConversationTurn } from "./types.js";
import type { ITaskRepository, TaskRecord } from "./task-repository.js";

export class SQLiteTaskRepository implements ITaskRepository {
  private readonly db: DatabaseSync;
  private readonly tableName: string;
  private readonly getStmt: StatementSync;
  private readonly getAllStmt: StatementSync;
  private readonly saveStmt: StatementSync;
  private readonly updateStatusStmt: StatementSync;
  private readonly updateResultStmt: StatementSync;
  private readonly appendConversationStmt: StatementSync;
  private readonly getConversationStmt: StatementSync;

  constructor(path: string, tableName: string = "tasks") {
    this.db = new DatabaseSync(path);
    this.tableName = tableName;
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
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName}_conversation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY(task_id) REFERENCES ${tableName}(id)
      )`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_conversation_task_time
       ON ${tableName}_conversation(task_id, timestamp, id)`,
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
    this.updateStatusStmt = this.db.prepare(
      `UPDATE ${tableName} SET status = ?, updated_at = ? WHERE id = ?`,
    );
    this.updateResultStmt = this.db.prepare(
      `UPDATE ${tableName} SET result = ?, status = ?, updated_at = ? WHERE id = ?`,
    );
    this.appendConversationStmt = this.db.prepare(
      `INSERT INTO ${tableName}_conversation (task_id, role, content, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.getConversationStmt = this.db.prepare(
      `SELECT role, content, timestamp, metadata
       FROM ${tableName}_conversation
       WHERE task_id = ?
       ORDER BY timestamp ASC, id ASC`,
    );

    this.migrateLegacyConversationRows();
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

  async setStatus(taskId: string, status: TaskRecord["status"]): Promise<void> {
    this.updateStatusStmt.run(status, Date.now(), taskId);
  }

  async saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void> {
    if (conversation && conversation.length > 0) {
      this.appendConversationRows(taskId, conversation);
    }
    this.updateResultStmt.run(JSON.stringify(result), status, Date.now(), taskId);
  }

  async appendConversation(taskId: string, conversation: ConversationTurn[]): Promise<void> {
    this.appendConversationRows(taskId, conversation);
    this.updateStatusStmt.run("running", Date.now(), taskId);
  }

  async getConversation(taskId: string): Promise<ConversationTurn[]> {
    const rows = this.getConversationStmt.all(taskId) as Record<string, unknown>[];
    if (rows.length > 0) {
      return rows.map((row) => this.rowToConversationTurn(row));
    }

    const taskRow = this.getStmt.get(taskId) as Record<string, unknown> | undefined;
    if (!taskRow?.conversation) {
      return [];
    }

    const legacyConversation = JSON.parse(taskRow.conversation as string) as ConversationTurn[];
    this.appendConversationRows(taskId, legacyConversation);
    return legacyConversation;
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    const row = this.getStmt.get(taskId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const record = this.rowToRecord(row);
    record.conversation = await this.getConversation(taskId);
    return record;
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
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private appendConversationRows(taskId: string, conversation: ConversationTurn[]): void {
    if (conversation.length === 0) {
      return;
    }

    for (const turn of conversation) {
      this.appendConversationStmt.run(
        taskId,
        turn.role,
        turn.content,
        turn.timestamp,
        turn.metadata ? JSON.stringify(turn.metadata) : null,
      );
    }
  }

  private rowToConversationTurn(row: Record<string, unknown>): ConversationTurn {
    return {
      role: row.role as ConversationTurn["role"],
      content: row.content as string,
      timestamp: row.timestamp as number,
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : undefined,
    };
  }

  private migrateLegacyConversationRows(): void {
    const legacyRows = this.db.prepare(
      `SELECT id, conversation
       FROM ${this.tableName}
       WHERE conversation IS NOT NULL`,
    ).all() as Array<{ id: string; conversation: string | null }>;

    const countStmt = this.db.prepare(
      `SELECT COUNT(*) AS count
       FROM ${this.tableName}_conversation
       WHERE task_id = ?`,
    );

    for (const row of legacyRows) {
      const serialized = row.conversation;
      if (!serialized) {
        continue;
      }

      const existing = countStmt.get(row.id) as { count: number };
      if (existing.count > 0) {
        continue;
      }

      try {
        const conversation = JSON.parse(serialized) as ConversationTurn[];
        if (Array.isArray(conversation) && conversation.length > 0) {
          this.appendConversationRows(row.id, conversation);
        }
      } catch {
        // Preserve the original row data in place and skip malformed legacy
        // conversation payloads so opening the database remains non-destructive.
      }
    }
  }
}
