import { describe, it, expect } from "vitest";
import { Prioritizer } from "../prioritizer.js";
import type { Task } from "../types.js";

function makeTask(id: string, priority: Task["priority"], createdAt: number): Task {
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
    priority,
    createdAt,
  };
}

describe("Prioritizer", () => {
  it("sorts by priority", () => {
    const prioritizer = new Prioritizer();
    const tasks: Task[] = [
      makeTask("batch1", "batch", 1),
      makeTask("normal1", "normal", 1),
      makeTask("high1", "high", 1),
      makeTask("critical1", "critical", 1),
    ];
    const sorted = prioritizer.prioritize(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["critical1", "high1", "normal1", "batch1"]);
  });

  it("preserves original array", () => {
    const prioritizer = new Prioritizer();
    const tasks: Task[] = [makeTask("a", "normal", 1), makeTask("b", "high", 1)];
    prioritizer.prioritize(tasks);
    expect(tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("sorts same priority by createdAt ascending", () => {
    const prioritizer = new Prioritizer();
    const tasks: Task[] = [
      makeTask("later", "normal", 200),
      makeTask("earlier", "normal", 100),
    ];
    const sorted = prioritizer.prioritize(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["earlier", "later"]);
  });

  it("handles mixed priorities and timestamps", () => {
    const prioritizer = new Prioritizer();
    const tasks: Task[] = [
      makeTask("n1", "normal", 100),
      makeTask("c1", "critical", 200),
      makeTask("h1", "high", 50),
      makeTask("n2", "normal", 50),
    ];
    const sorted = prioritizer.prioritize(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["c1", "h1", "n2", "n1"]);
  });
});
