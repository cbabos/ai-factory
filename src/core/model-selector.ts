import type { SubTask, ModelChoice, BudgetState, ModelInfo } from "./types.js";
import type { IModelSelector } from "./interfaces.js";

export class ModelSelector implements IModelSelector {
  private catalog: ModelInfo[];

  constructor(catalog: ModelInfo[]) {
    this.catalog = catalog;
  }

  async select(subTask: SubTask, budget: BudgetState[]): Promise<ModelChoice> {
    const budgetMap = new Map(budget.map((b) => [b.provider, b]));
    const requiredTags = subTask.capabilityTags;

    const candidates = this.catalog
      .filter((m) => requiredTags.every((t) => m.capabilities.includes(t)))
      .map((m) => {
        const estimatedTokens = subTask.complexity.estimatedTokens;
        const estimatedCost =
          (estimatedTokens.expected / 1000) * m.costPer1kInput +
          (estimatedTokens.expected / 1000) * m.costPer1kOutput;
        const state = budgetMap.get(m.provider);
        const affordable = state ? state.remaining >= estimatedCost : false;
        return { model: m, estimatedCost, affordable };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    const affordable = candidates.filter((c) => c.affordable);
    const primary = affordable[0] ?? candidates[0];

    if (!primary) {
      throw new Error(
        `No model found for capabilities: ${requiredTags.join(", ")}`,
      );
    }

    const fallback = affordable.find(
      (c) => c.model.provider !== primary.model.provider,
    );

    return {
      provider: primary.model.provider,
      modelId: primary.model.modelId,
      estimatedTokens: subTask.complexity.estimatedTokens,
      estimatedCost: primary.estimatedCost,
      fallback: fallback
        ? {
            provider: fallback.model.provider,
            modelId: fallback.model.modelId,
            estimatedTokens: subTask.complexity.estimatedTokens,
            estimatedCost: fallback.estimatedCost,
          }
        : undefined,
    };
  }
}
