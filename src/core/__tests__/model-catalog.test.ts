import { describe, it, expect, vi } from "vitest";
import { ModelCatalog } from "../model-catalog.js";
import { NoopLogger } from "../logger.js";
import type { ILLMCaller, LLMCallResult } from "../interfaces.js";
import type { DiscoveredModel, ModelInfo, Provider } from "../types.js";

function makeCaller(
  provider: Provider,
  models: DiscoveredModel[],
): ILLMCaller {
  return {
    provider,
    call: vi.fn().mockResolvedValue({} as LLMCallResult),
    callStructured: vi.fn().mockResolvedValue({}),
    estimateTokens: vi.fn().mockReturnValue(1),
    listModels: vi.fn().mockResolvedValue(models),
  };
}

describe("ModelCatalog", () => {
  it("discovers models from all callers", async () => {
    const callerA = makeCaller("openai", [
      { provider: "openai", modelId: "gpt-4o", ownedBy: "openai" },
    ]);
    const callerB = makeCaller("anthropic", [
      { provider: "anthropic", modelId: "claude-3", ownedBy: "anthropic" },
    ]);

    const catalog = new ModelCatalog([callerA, callerB], []);
    const entries = await catalog.discoverAll();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.discovered.modelId).sort()).toEqual(["claude-3", "gpt-4o"]);
  });

  it("deduplicates discovered models", async () => {
    const callerA = makeCaller("openai", [
      { provider: "openai", modelId: "gpt-4o", ownedBy: "openai" },
    ]);
    const callerB = makeCaller("openai", [
      { provider: "openai", modelId: "gpt-4o", ownedBy: "openai" },
    ]);

    const catalog = new ModelCatalog([callerA, callerB], []);
    const entries = await catalog.discoverAll();
    expect(entries).toHaveLength(1);
  });

  it("enriches discovered models with static catalog info", async () => {
    const caller = makeCaller("openai", [
      { provider: "openai", modelId: "gpt-4o", ownedBy: "openai" },
    ]);
    const staticModels: ModelInfo[] = [
      {
        provider: "openai",
        modelId: "gpt-4o",
        maxTokens: 128000,
        costPer1kInput: 0.001,
        costPer1kOutput: 0.002,
        capabilities: ["analysis"],
      },
    ];

    const catalog = new ModelCatalog([caller], staticModels);
    const entries = await catalog.discoverAll();
    expect(entries[0]?.enriched).toEqual(staticModels[0]);
  });

  it("survives caller listModel failures", async () => {
    const good = makeCaller("openai", [{ provider: "openai", modelId: "gpt-4o", ownedBy: "openai" }]);
    const bad: ILLMCaller = {
      provider: "openai",
      call: vi.fn(),
      callStructured: vi.fn(),
      estimateTokens: vi.fn(),
      listModels: vi.fn().mockRejectedValue(new Error("network")),
    };

    const catalog = new ModelCatalog([bad, good], [], new NoopLogger());
    const entries = await catalog.discoverAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.discovered.modelId).toBe("gpt-4o");
  });

  it("returns static models by provider", () => {
    const staticModels: ModelInfo[] = [
      {
        provider: "openai",
        modelId: "gpt-4o",
        maxTokens: 128000,
        costPer1kInput: 0.001,
        costPer1kOutput: 0.002,
        capabilities: ["analysis"],
      },
    ];

    const catalog = new ModelCatalog([], staticModels);
    expect(catalog.getStaticModels()).toEqual(staticModels);
    const byProvider = catalog.findByProvider("openai");
    expect(byProvider).toHaveLength(1);
    expect(byProvider[0]?.discovered.modelId).toBe("gpt-4o");
    expect(byProvider[0]?.enriched).toEqual(staticModels[0]);
  });
});
