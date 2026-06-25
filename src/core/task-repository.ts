import type { Task, FinalResult, ConversationTurn, TaskExecutionStatus } from "./types.js";

export interface TaskRecord {
  id: string;
  task: Task;
  result?: FinalResult;
  status: TaskExecutionStatus;
  conversation?: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface ITaskRepository {
  saveTask(task: Task): Promise<void>;
  setStatus(taskId: string, status: TaskRecord["status"]): Promise<void>;
  saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void>;
  appendConversation(taskId: string, conversation: ConversationTurn[]): Promise<void>;
  getConversation(taskId: string): Promise<ConversationTurn[]>;
  get(taskId: string): Promise<TaskRecord | undefined>;
  getAll(): Promise<TaskRecord[]>;
  close(): Promise<void>;
}

export class InMemoryTaskRepository implements ITaskRepository {
  private records = new Map<string, TaskRecord>();

  async saveTask(task: Task): Promise<void> {
    const now = Date.now();
    const existing = this.records.get(task.id);
    this.records.set(task.id, {
      id: task.id,
      task,
      status: "pending",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async setStatus(taskId: string, status: TaskRecord["status"]): Promise<void> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.records.set(taskId, {
      ...existing,
      status,
      updatedAt: Date.now(),
    });
  }

  async saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    const appendedConversation = conversation && conversation.length > 0
      ? [...(existing.conversation ?? []), ...conversation]
      : existing.conversation;
    this.records.set(taskId, {
      ...existing,
      result,
      status,
      conversation: appendedConversation,
      updatedAt: Date.now(),
    });
  }

  async appendConversation(taskId: string, conversation: ConversationTurn[]): Promise<void> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.records.set(taskId, {
      ...existing,
      conversation: [...(existing.conversation ?? []), ...conversation],
      updatedAt: Date.now(),
    });
  }

  async getConversation(taskId: string): Promise<ConversationTurn[]> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    return existing.conversation ?? [];
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    return this.records.get(taskId);
  }

  async getAll(): Promise<TaskRecord[]> {
    return [...this.records.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async close(): Promise<void> {
    this.records.clear();
  }
}
