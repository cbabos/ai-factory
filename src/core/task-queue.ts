import type { Task } from "./types.js";

export interface ITaskQueue {
  enqueue(task: Task): Promise<void>;
  dequeue(): Promise<Task | undefined>;
  peek(): Promise<Task | undefined>;
  size(): Promise<number>;
  drain(): Promise<Task[]>;
}

export class InMemoryTaskQueue implements ITaskQueue {
  private queue: Task[] = [];

  async enqueue(task: Task): Promise<void> {
    this.queue.push(task);
  }

  async dequeue(): Promise<Task | undefined> {
    return this.queue.shift();
  }

  async peek(): Promise<Task | undefined> {
    return this.queue[0];
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async drain(): Promise<Task[]> {
    const tasks = [...this.queue];
    this.queue = [];
    return tasks;
  }
}
