import { describe, it, expect } from "vitest";
import { InMemoryTaskQueue } from "../task-queue.js";
import type { Task } from "../types.js";

function makeTask(id: string): Task {
  return {
    id,
    description: "task",
    context: {},
    origin: {
      channel: "webhook",
      replyTo: "",
      messageId: "",
      rawPayload: {},
    },
    priority: "normal",
    createdAt: Date.now(),
  };
}

describe("InMemoryTaskQueue", () => {
  it("enqueues and dequeues", async () => {
    const queue = new InMemoryTaskQueue();
    const t1 = makeTask("1");
    await queue.enqueue(t1);
    expect(await queue.size()).toBe(1);
    expect(await queue.dequeue()).toEqual(t1);
    expect(await queue.size()).toBe(0);
  });

  it("peeks at front without removing", async () => {
    const queue = new InMemoryTaskQueue();
    const t1 = makeTask("1");
    await queue.enqueue(t1);
    expect(await queue.peek()).toEqual(t1);
    expect(await queue.size()).toBe(1);
  });

  it("drains all tasks", async () => {
    const queue = new InMemoryTaskQueue();
    await queue.enqueue(makeTask("1"));
    await queue.enqueue(makeTask("2"));
    const drained = await queue.drain();
    expect(drained).toHaveLength(2);
    expect(await queue.size()).toBe(0);
  });

  it("returns undefined when empty", async () => {
    const queue = new InMemoryTaskQueue();
    expect(await queue.dequeue()).toBeUndefined();
    expect(await queue.peek()).toBeUndefined();
    expect(await queue.drain()).toEqual([]);
  });
});
