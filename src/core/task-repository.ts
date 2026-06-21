import type { Task, FinalResult, ConversationTurn } from "./types.js";

export interface TaskRecord {
  id: string;
  task: Task;
  result?: FinalResult;
  status: "pending" | "running" | "completed" | "failed";
  conversation?: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface ITaskRepository {
  saveTask(task: Task): Promise<void>;
  saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void>;
  saveConversation(taskId: string, conversation: ConversationTurn[]): Promise<void>;
  get(taskId: string): Promise<TaskRecord | undefined>;
  getAll(): Promise<TaskRecord[]>;
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

  async saveResult(taskId: string, result: FinalResult, status: TaskRecord["status"], conversation?: ConversationTurn[]): Promise<void> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.records.set(taskId, {
      ...existing,
      result,
      status,
      conversation,
      updatedAt: Date.now(),
    });
  }

  async saveConversation(taskId: string, conversation: ConversationTurn[]): Promise<void> {
    const existing = this.records.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found`);
    }
    this.records.set(taskId, {
      ...existing,
      conversation,
      updatedAt: Date.now(),
    });
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    return this.records.get(taskId);
  }

  async getAll(): Promise<TaskRecord[]> {
    return [...this.records.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
