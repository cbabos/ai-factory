import { existsSync, readFileSync } from "node:fs";
import type { AgentManifest, FactoryConfig } from "./types.js";

const DEFAULT_AGENT_MANIFESTS: AgentManifest[] = [];

export const DEFAULT_FACTORY_CONFIG: Required<FactoryConfig> = {
  complexity: {
    decompositionThreshold: 5,
    estimatorModel: "",
  },
  budget: {
    defaultCap: 10,
    softCapRatio: 0.8,
  },
  dispatch: {
    maxConcurrency: 5,
    defaultTimeoutMs: 120000,
  },
  models: [],
  agents: DEFAULT_AGENT_MANIFESTS,
};

export function normalizeFactoryConfig(input: FactoryConfig): Required<FactoryConfig> {
  return {
    complexity: {
      decompositionThreshold: input.complexity?.decompositionThreshold ?? DEFAULT_FACTORY_CONFIG.complexity.decompositionThreshold,
      estimatorModel: input.complexity?.estimatorModel ?? DEFAULT_FACTORY_CONFIG.complexity.estimatorModel,
    },
    budget: {
      defaultCap: input.budget?.defaultCap ?? DEFAULT_FACTORY_CONFIG.budget.defaultCap,
      softCapRatio: input.budget?.softCapRatio ?? DEFAULT_FACTORY_CONFIG.budget.softCapRatio,
    },
    dispatch: {
      maxConcurrency: input.dispatch?.maxConcurrency ?? DEFAULT_FACTORY_CONFIG.dispatch.maxConcurrency,
      defaultTimeoutMs: input.dispatch?.defaultTimeoutMs ?? DEFAULT_FACTORY_CONFIG.dispatch.defaultTimeoutMs,
    },
    models: input.models ?? DEFAULT_FACTORY_CONFIG.models,
    agents: input.agents && input.agents.length > 0 ? input.agents : DEFAULT_FACTORY_CONFIG.agents,
  };
}

export function loadConfig(path: string): FactoryConfig {
  if (!existsSync(path)) {
    return DEFAULT_FACTORY_CONFIG;
  }
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as FactoryConfig;
  return normalizeFactoryConfig(parsed);
}
