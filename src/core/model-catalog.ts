import type { DiscoveredModel, ModelInfo, Provider } from "../core/types.js";
import type { ILLMCaller } from "../core/interfaces.js";

export interface CatalogEntry {
  discovered: DiscoveredModel;
  enriched?: ModelInfo;
}

export class ModelCatalog {
  private callers: ILLMCaller[];
  private staticModels: ModelInfo[];

  constructor(callers: ILLMCaller[], staticModels: ModelInfo[] = []) {
    this.callers = callers;
    this.staticModels = staticModels;
  }

  async discoverAll(): Promise<CatalogEntry[]> {
    const results: CatalogEntry[] = [];
    const seen = new Set<string>();

    for (const caller of this.callers) {
      try {
        const models = await caller.listModels();
        for (const m of models) {
          const key = `${m.provider}:${m.modelId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const enriched = this.staticModels.find(
            (s) => s.provider === m.provider && s.modelId === m.modelId,
          );

          results.push({ discovered: m, enriched });
        }
      } catch (err) {
        console.error(
          `[ModelCatalog] Failed to list models from caller:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return results;
  }

  getStaticModels(): ModelInfo[] {
    return this.staticModels;
  }

  findByProvider(provider: Provider): CatalogEntry[] {
    return this.staticModels
      .filter((m) => m.provider === provider)
      .map((m) => ({
        discovered: {
          provider: m.provider,
          modelId: m.modelId,
          ownedBy: m.provider,
        },
        enriched: m,
      }));
  }
}
