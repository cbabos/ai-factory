import { describe, it, expect, vi } from "vitest";
import { Dispatcher } from "../dispatcher.js";
import { AgentRegistry } from "../agent-registry.js";
import { EventBus } from "../event-bus.js";
import type { SubTask, TaskResult, AgentManifest } from "../types.js";
import type { IAgent } from "../interfaces.js";

function makeManifest(id: string, tags: string[], complexityRange: [number, number]): AgentManifest {
  return {
    id,
    tags,
    complexityRange,
    timeoutMs: 30000,
    maxRetries: 2,
  };
}

function makeAgent(id: string, tags: string[], complexityRange: [number, number], result: TaskResult): IAgent {
  return {
    manifest: makeManifest(id, tags, complexityRange),
    name: id,
    execute: vi.fn().mockResolvedValue(result),
  } as unknown as IAgent;
}

function makeSubTask(
  id: string,
  tags: string[],
  deps: string[] = [],
  score = 3,
): SubTask {
  return {
    id,
    parentTaskId: "t1",
    description: "sub",
    context: {},
    dependencies: deps,
    capabilityTags: tags,
    complexity: {
      score,
      confidence: 0.9,
      reasoning: "ok",
      estimatedTokens: { min: 0, max: 100, expected: 50 },
    },
    priority: "normal",
  };
}

describe("Dispatcher", () => {
  it("executes a single sub-task", async () => {
    const registry = new AgentRegistry(new EventBus());
    const result: TaskResult = {
      subTaskId: "s1",
      output: "done",
      success: true,
      actualTokens: { input: 10, output: 10, total: 20 },
      actualCost: 0.001,
      modelUsed: {
        provider: "openai",
        modelId: "gpt-4o-mini",
        estimatedTokens: { min: 0, max: 0, expected: 0 },
        estimatedCost: 0,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      latencyMs: 5,
      retries: 0,
    };
    const agent = makeAgent("searcher", ["search"], [1, 4], result);
    const dispatcher = new Dispatcher(registry, new Map([["searcher", agent]]), 5);
    registry.register(agent.manifest);
    const subTask = makeSubTask("s1", ["search"]);
    const results = await dispatcher.execute([subTask]);
    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(agent.execute).toHaveBeenCalledWith(subTask);
  });

  it("respects dependencies", async () => {
    const registry = new AgentRegistry(new EventBus());
    const result: TaskResult = {
      subTaskId: "x",
      output: "ok",
      success: true,
      actualTokens: { input: 0, output: 0, total: 0 },
      actualCost: 0,
      modelUsed: {
        provider: "openai",
        modelId: "x",
        estimatedTokens: { min: 0, max: 0, expected: 0 },
        estimatedCost: 0,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      latencyMs: 1,
      retries: 0,
    };
    const agent = makeAgent("exec", ["exec"], [1, 4], result);
    registry.register(agent.manifest);
    const dispatcher = new Dispatcher(registry, new Map([["exec", agent]]), 5);
    const order: string[] = [];
    agent.execute = vi.fn().mockImplementation(async (st: SubTask) => {
      order.push(st.id);
      return { ...result, subTaskId: st.id };
    });

    const subTasks = [
      makeSubTask("s1", ["exec"]),
      makeSubTask("s2", ["exec"], ["s1"]),
    ];
    await dispatcher.execute(subTasks);
    expect(order).toEqual(["s1", "s2"]);
  });

  it("returns no-agent result when no agent matches", async () => {
    const registry = new AgentRegistry(new EventBus());
    const dispatcher = new Dispatcher(registry, new Map(), 5);
    const subTask = makeSubTask("s1", ["missing"]);
    const results = await dispatcher.execute([subTask]);
    expect(results[0]?.success).toBe(false);
    expect(results[0]?.error).toMatch(/No agent found/);
  });

  it("prefers the highest-ranked tag match instead of complexity range", async () => {
    const registry = new AgentRegistry(new EventBus());
    const result: TaskResult = {
      subTaskId: "s1",
      output: "done",
      success: true,
      actualTokens: { input: 10, output: 10, total: 20 },
      actualCost: 0.001,
      modelUsed: {
        provider: "openai",
        modelId: "gpt-4o-mini",
        estimatedTokens: { min: 0, max: 0, expected: 0 },
        estimatedCost: 0,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      latencyMs: 5,
      retries: 0,
    };
    const specialist = makeAgent("specialist", ["mcp"], [5, 10], result);
    const broad = makeAgent("broad", ["mcp", "analysis", "execution"], [1, 10], result);
    registry.register(broad.manifest);
    registry.register(specialist.manifest);
    const dispatcher = new Dispatcher(
      registry,
      new Map([
        ["specialist", specialist],
        ["broad", broad],
      ]),
      5,
    );

    await dispatcher.execute([makeSubTask("s1", ["mcp"], [], 3)]);
    expect(specialist.execute).toHaveBeenCalled();
    expect(broad.execute).not.toHaveBeenCalled();
  });

  it("handles dependency cycles", async () => {
    const registry = new AgentRegistry(new EventBus());
    const dispatcher = new Dispatcher(registry, new Map(), 5);
    const subTasks = [
      makeSubTask("s1", ["missing"], ["s2"]),
      makeSubTask("s2", ["missing"], ["s1"]),
    ];
    const results = await dispatcher.execute(subTasks);
    expect(results.every((r) => !r.success)).toBe(true);
    expect(results[0]?.error).toMatch(/Unresolvable/);
  });

  it("limits concurrency", async () => {
    const registry = new AgentRegistry(new EventBus());
    const result: TaskResult = {
      subTaskId: "x",
      output: "ok",
      success: true,
      actualTokens: { input: 0, output: 0, total: 0 },
      actualCost: 0,
      modelUsed: {
        provider: "openai",
        modelId: "x",
        estimatedTokens: { min: 0, max: 0, expected: 0 },
        estimatedCost: 0,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      latencyMs: 1,
      retries: 0,
    };
    const agent = makeAgent("exec", ["exec"], [1, 4], result);
    registry.register(agent.manifest);
    const dispatcher = new Dispatcher(registry, new Map([["exec", agent]]), 2);

    let running = 0;
    let maxRunning = 0;
    agent.execute = vi.fn().mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return result;
    });

    const subTasks = Array.from({ length: 5 }, (_, i) => makeSubTask(`s${i}`, ["exec"]));
    await dispatcher.execute(subTasks);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });
});
