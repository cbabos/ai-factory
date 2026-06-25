import { describe, it, expect } from "vitest";
import { TaskFactory } from "../task-factory.js";
import type { Signal } from "../types.js";

function makeSignal(content: string, metadata: Record<string, unknown> = {}): Signal {
  return {
    channel: "webhook",
    content,
    receivedAt: Date.now(),
    metadata,
  };
}

describe("TaskFactory", () => {
  it("creates a task from a signal", () => {
    const factory = new TaskFactory();
    const signal = makeSignal("do something", { replyTo: "user@example.com", messageId: "m1" });
    const task = factory.create(signal);
    expect(task.description).toBe("do something");
    expect(task.origin.channel).toBe("webhook");
    expect(task.origin.replyTo).toBe("user@example.com");
    expect(task.origin.messageId).toBe("m1");
    expect(task.priority).toBe("normal");
    expect(task.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("generates unique ids", () => {
    const factory = new TaskFactory();
    const t1 = factory.create(makeSignal("a"));
    const t2 = factory.create(makeSignal("b"));
    expect(t1.id).not.toBe(t2.id);
  });

  it("derives critical priority from metadata", () => {
    const factory = new TaskFactory();
    expect(factory.create(makeSignal("a", { urgent: true })).priority).toBe("critical");
    expect(factory.create(makeSignal("a", { priority: "critical" })).priority).toBe("critical");
  });

  it("derives high and batch priorities", () => {
    const factory = new TaskFactory();
    expect(factory.create(makeSignal("a", { priority: "high" })).priority).toBe("high");
    expect(factory.create(makeSignal("a", { priority: "batch" })).priority).toBe("batch");
  });

  it("includes raw payload in origin", () => {
    const factory = new TaskFactory();
    const raw = { source: "test" };
    const signal = makeSignal("x", { rawPayload: raw });
    const task = factory.create(signal);
    expect(task.origin.rawPayload).toEqual(raw);
  });

  it("derives workflow selection from metadata", () => {
    const factory = new TaskFactory();
    const task = factory.create(makeSignal("x", { workflowId: "requirements-review", workflowVersion: 2 }));
    expect(task.workflow).toEqual({ workflowId: "requirements-review", workflowVersion: 2 });
  });
});
