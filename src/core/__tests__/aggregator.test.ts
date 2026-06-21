import { describe, it, expect } from "vitest";
import { Aggregator } from "../aggregator.js";
import type { Task, TaskResult } from "../types.js";

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

function makeResult(
  subTaskId: string,
  output: unknown,
  success: boolean,
  provider: string,
  modelId: string,
  input: number,
  outputTokens: number,
  cost: number,
): TaskResult {
  return {
    subTaskId,
    output,
    success,
    actualTokens: { input, output: outputTokens, total: input + outputTokens },
    actualCost: cost,
    modelUsed: {
      provider: provider as TaskResult["modelUsed"]["provider"],
      modelId,
      estimatedTokens: { min: 0, max: 0, expected: 0 },
      estimatedCost: 0,
    },
    latencyMs: 10,
    retries: 0,
  };
}

describe("Aggregator", () => {
  it("aggregates successful results", () => {
    const aggregator = new Aggregator();
    const task = makeTask("t1");
    const results = [
      makeResult("s1", "a", true, "openai", "gpt-4o-mini", 10, 20, 0.001),
      makeResult("s2", "b", true, "openai", "gpt-4o-mini", 5, 15, 0.002),
    ];
    const final = aggregator.aggregate(task, results);
    expect(final.success).toBe(true);
    expect(final.output).toEqual(["a", "b"]);
    expect(final.totalTokens).toEqual({ input: 15, output: 35, total: 50 });
    expect(final.totalCost).toBeCloseTo(0.003, 6);
    expect(final.totalLatencyMs).toBe(20);
  });

  it("marks failure if any sub-task fails", () => {
    const aggregator = new Aggregator();
    const task = makeTask("t1");
    const results = [
      makeResult("s1", "a", true, "openai", "gpt-4o-mini", 10, 20, 0.001),
      makeResult("s2", null, false, "openai", "gpt-4o-mini", 5, 15, 0.002),
    ];
    const final = aggregator.aggregate(task, results);
    expect(final.success).toBe(false);
    expect(final.output).toHaveProperty("error");
  });

  it("breaks down tokens by provider:model", () => {
    const aggregator = new Aggregator();
    const task = makeTask("t1");
    const results = [
      makeResult("s1", "a", true, "openai", "gpt-4o-mini", 10, 20, 0.001),
      makeResult("s2", "b", true, "anthropic", "claude-haiku", 5, 10, 0.002),
      makeResult("s3", "c", true, "openai", "gpt-4o-mini", 15, 5, 0.003),
    ];
    const final = aggregator.aggregate(task, results);
    expect(final.modelBreakdown["openai:gpt-4o-mini"]).toEqual({ input: 25, output: 25, total: 50 });
    expect(final.modelBreakdown["anthropic:claude-haiku"]).toEqual({ input: 5, output: 10, total: 15 });
  });

  it("handles empty results", () => {
    const aggregator = new Aggregator();
    const task = makeTask("t1");
    const final = aggregator.aggregate(task, []);
    expect(final.success).toBe(true);
    expect(final.output).toEqual([]);
    expect(final.totalTokens).toEqual({ input: 0, output: 0, total: 0 });
    expect(final.totalCost).toBe(0);
  });
});
