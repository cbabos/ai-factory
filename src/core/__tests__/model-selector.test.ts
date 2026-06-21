import { describe, it, expect } from "vitest";
import { ModelSelector } from "../model-selector.js";
import type { ModelInfo, SubTask, BudgetState } from "../types.js";

function makeModel(
  provider: ModelInfo["provider"],
  modelId: string,
  costInput: number,
  costOutput: number,
  capabilities: string[],
): ModelInfo {
  return {
    provider,
    modelId,
    maxTokens: 1000,
    costPer1kInput: costInput,
    costPer1kOutput: costOutput,
    capabilities,
  };
}

function makeSubTask(tags: string[], expectedTokens: number): SubTask {
  return {
    id: "s1",
    parentTaskId: "t1",
    description: "sub",
    context: {},
    dependencies: [],
    capabilityTags: tags,
    complexity: {
      score: 3,
      confidence: 0.9,
      reasoning: "ok",
      estimatedTokens: { min: 0, max: expectedTokens * 2, expected: expectedTokens },
    },
    priority: "normal",
  };
}

function makeBudgetState(provider: string, remaining: number): BudgetState {
  return {
    provider: provider as BudgetState["provider"],
    allocated: 100,
    consumed: 100 - remaining,
    remaining,
    cap: 100,
    softCap: 80,
  };
}

describe("ModelSelector", () => {
  it("selects cheapest model that matches tags when order is equal", async () => {
    const catalog: ModelInfo[] = [
      makeModel("openai", "gpt-4o", 0.01, 0.03, ["analysis"]),
      makeModel("openai", "gpt-4o-mini", 0.001, 0.003, ["analysis"]),
    ];
    const selector = new ModelSelector(catalog);
    const subTask = makeSubTask(["analysis"], 1000);
    const budget: BudgetState[] = [makeBudgetState("openai", 100)];
    const choice = await selector.select(subTask, budget);
    expect(choice.modelId).toBe("gpt-4o-mini");
  });

  it("selects model with required capabilities only", async () => {
    const catalog: ModelInfo[] = [
      makeModel("openai", "cheap", 0.001, 0.001, ["search"]),
      makeModel("openai", "expensive", 0.01, 0.01, ["analysis"]),
    ];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [makeBudgetState("openai", 100)]);
    expect(choice.modelId).toBe("expensive");
  });

  it("throws when no model matches capabilities", async () => {
    const selector = new ModelSelector([]);
    await expect(
      selector.select(makeSubTask(["missing"], 1000), [makeBudgetState("openai", 100)]),
    ).rejects.toThrow("No model found for capabilities: missing");
  });

  it("sets a fallback from a different provider", async () => {
    const catalog: ModelInfo[] = [
      makeModel("openai", "gpt-4o-mini", 0.001, 0.001, ["analysis"]),
      makeModel("anthropic", "claude-haiku", 0.002, 0.002, ["analysis"]),
    ];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [
      makeBudgetState("openai", 100),
      makeBudgetState("anthropic", 100),
    ]);
    expect(choice.provider).toBe("openai");
    expect(choice.fallback?.provider).toBe("anthropic");
  });

  it("does not set fallback when only one provider is affordable", async () => {
    const catalog: ModelInfo[] = [
      makeModel("openai", "gpt-4o-mini", 0.001, 0.001, ["analysis"]),
      makeModel("anthropic", "claude-haiku", 0.002, 0.002, ["analysis"]),
    ];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [makeBudgetState("openai", 100)]);
    expect(choice.provider).toBe("openai");
    expect(choice.fallback).toBeUndefined();
  });

  it("selects unaffordable model if nothing is affordable", async () => {
    const catalog: ModelInfo[] = [makeModel("openai", "gpt-4o", 1, 1, ["analysis"])];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [makeBudgetState("openai", 0.5)]);
    expect(choice.modelId).toBe("gpt-4o");
    expect(choice.estimatedCost).toBeGreaterThan(0.5);
    expect(choice.fallback).toBeUndefined();
  });

  it("prefers configured models over cheaper discovered models", async () => {
    // Configured model has explicit cost; discovered cheap model has zero cost.
    const catalog: ModelInfo[] = [
      makeModel("omlx", "configured-model", 1, 1, ["analysis", "search", "summarization"]),
      makeModel("omlx", "discovered-qwen", 0, 0, ["analysis", "search", "summarization"]),
    ];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [makeBudgetState("omlx", 100)]);
    expect(choice.modelId).toBe("configured-model");
  });

  it("falls back to discovered model only when no configured model matches", async () => {
    const catalog: ModelInfo[] = [
      makeModel("omlx", "configured-model", 0.001, 0.001, ["search"]),
      makeModel("omlx", "discovered-qwen", 0.001, 0.001, ["analysis"]),
    ];
    const selector = new ModelSelector(catalog);
    const choice = await selector.select(makeSubTask(["analysis"], 1000), [makeBudgetState("omlx", 100)]);
    expect(choice.modelId).toBe("discovered-qwen");
  });
});
