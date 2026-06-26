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

    // Split catalog into configured (static) and discovered models. We treat
    // models without explicit cost as discovered, because the factory only
    // assigns conservative defaults to newly discovered models.
    const isConfigured = (m: ModelInfo): boolean =>
      m.costPer1kInput !== 0 || m.costPer1kOutput !== 0;

    const configured = this.catalog.filter(isConfigured);
    const discovered = this.catalog.filter((m) => !isConfigured(m));

    const scoreModel = (m: ModelInfo, index: number) => {
      const estimatedTokens = subTask.complexity.estimatedTokens;
      const estimatedCost =
        (estimatedTokens.expected / 1000) * m.costPer1kInput +
        (estimatedTokens.expected / 1000) * m.costPer1kOutput;
      const state = budgetMap.get(m.provider);
      const affordable = state ? state.remaining >= estimatedCost : false;
      return { model: m, estimatedCost, affordable, index };
    };

    const match = (m: ModelInfo): boolean =>
      requiredTags.every((t) => m.capabilities.includes(t));

    const configuredMatches = configured
      .map(scoreModel)
      .filter((c) => match(c.model))
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    const discoveredMatches = discovered
      .map((m, i) => scoreModel(m, i))
      .filter((c) => match(c.model))
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    const scored = configuredMatches.length > 0
      ? configuredMatches
      : discoveredMatches;

    const affordable = scored.filter((c) => c.affordable);
    const primary = affordable[0] ?? scored[0];

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
      costPer1kInput: primary.model.costPer1kInput,
      costPer1kOutput: primary.model.costPer1kOutput,
      maxTokens: primary.model.maxTokens,
      fallback: fallback
        ? {
            provider: fallback.model.provider,
            modelId: fallback.model.modelId,
            estimatedTokens: subTask.complexity.estimatedTokens,
            estimatedCost: fallback.estimatedCost,
            costPer1kInput: fallback.model.costPer1kInput,
            costPer1kOutput: fallback.model.costPer1kOutput,
            maxTokens: fallback.model.maxTokens,
          }
        : undefined,
    };
  }
}
