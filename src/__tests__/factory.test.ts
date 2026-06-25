import { describe, it, expect, vi } from "vitest";
import { AIFactory } from "../factory.js";
import { EnvSecretsProvider } from "../core/secrets.js";
import {
  CronSensor,
  WebhookSensor,
} from "../sensors/index.js";
import {
  WebhookAdapter,
  CronAdapter,
} from "../adapters/index.js";
import {
  WebhookResponder,
  CronResponder,
} from "../responders/index.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../core/interfaces.js";
import { NoopLogger } from "../core/logger.js";
import { InMemoryTaskRepository } from "../core/task-repository.js";
import type { FactoryConfig } from "../core/types.js";

function makeFakeCaller(): ILLMCaller {
  const call = vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>().mockImplementation(async () => ({
    content: JSON.stringify({
      score: 3,
      confidence: 0.9,
      reasoning: "simple",
      estimatedTokens: { min: 10, expected: 50, max: 100 },
    }),
    usage: { input: 10, output: 10, total: 20 },
    model: "gpt-4o-mini",
    provider: "openai",
    latencyMs: 5,
  }));

  return {
    provider: "openai",
    call,
    callStructured: vi.fn().mockImplementation(async () => {
      return JSON.parse((await call("", { model: "", provider: "" })).content);
    }) as ILLMCaller["callStructured"],
    estimateTokens: vi.fn().mockReturnValue(10),
    listModels: vi.fn().mockResolvedValue([
      { provider: "openai", modelId: "gpt-4o-mini", ownedBy: "openai" },
    ]),
  };
}

function makeConfig(): FactoryConfig {
  return {
    complexity: {
      decompositionThreshold: 5,
      estimatorModel: "gpt-4o-mini",
    },
    budget: {
      defaultCap: 100,
      softCapRatio: 0.8,
    },
    dispatch: {
      maxConcurrency: 5,
      defaultTimeoutMs: 120000,
    },
    models: [
      {
        provider: "openai",
        modelId: "gpt-4o-mini",
        maxTokens: 128000,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
        capabilities: [
          "search", "analysis", "summarization", "execution", "code-generation",
          "file-io", "read-only", "write", "reasoning", "synthesis",
        ],
      },
    ],
    agents: [
      {
        id: "search-agent",
        tags: ["search", "codebase", "read-only"],
        complexityRange: [1, 4],
        tokenProfile: { min: 200, max: 2000, typical: 800 },
        preferredModels: ["gpt-4o-mini"],
        timeoutMs: 30000,
        maxRetries: 2,
      },
      {
        id: "analysis-agent",
        tags: ["analysis", "reasoning"],
        complexityRange: [3, 7],
        tokenProfile: { min: 500, max: 4000, typical: 1500 },
        preferredModels: ["gpt-4o-mini"],
        timeoutMs: 60000,
        maxRetries: 2,
      },
      {
        id: "summarizer-agent",
        tags: ["summarization", "synthesis"],
        complexityRange: [1, 5],
        tokenProfile: { min: 200, max: 1500, typical: 600 },
        preferredModels: ["gpt-4o-mini"],
        timeoutMs: 30000,
        maxRetries: 1,
      },
      {
        id: "executor-agent",
        tags: ["execution", "code-generation", "write"],
        complexityRange: [3, 8],
        tokenProfile: { min: 500, max: 8000, typical: 2000 },
        preferredModels: ["gpt-4o-mini"],
        timeoutMs: 120000,
        maxRetries: 1,
      },
      {
        id: "file-io-agent",
        tags: ["file-io", "read-only", "write"],
        complexityRange: [1, 3],
        tokenProfile: { min: 100, max: 1000, typical: 400 },
        preferredModels: ["gpt-4o-mini"],
        timeoutMs: 15000,
        maxRetries: 2,
      },
    ],
  };
}

function makeSecrets(): EnvSecretsProvider {
  return {
    provider: "openai",
    get: (_key: string) => undefined,
  } as EnvSecretsProvider;
}

describe("AIFactory integration", () => {
  it("processes a cron signal through the full pipeline", async () => {
    const taskRepository = new InMemoryTaskRepository();
    const factory = new AIFactory({
      config: makeConfig(),
      secrets: makeSecrets(),
      callers: new Map([["openai", makeFakeCaller()]]),
      logger: new NoopLogger(),
      taskRepository,
    });

    factory.registerAdapter(new CronAdapter());
    factory.registerResponder(new CronResponder());

    const sensor = new CronSensor(50, "status check");
    factory.registerSensor(sensor);

    const completedTasks: unknown[] = [];
    factory.getEventBus().on("task:completed", (event) => {
      completedTasks.push(event.payload);
    });

    const startPromise = factory.start();
    await new Promise((r) => setTimeout(r, 250));
    await factory.stop();
    await startPromise;

    expect(completedTasks.length).toBeGreaterThanOrEqual(1);
    const records = await taskRepository.getAll();
    expect(records.length).toBeGreaterThanOrEqual(1);
    const completedRecord = records.find((record) => record.status === "completed");
    expect(completedRecord).toBeDefined();
    expect((completedRecord?.conversation ?? []).length).toBeGreaterThan(0);
  });

  it("processes a webhook signal via manual injection", async () => {
    const factory = new AIFactory({ config: makeConfig(), secrets: makeSecrets(), callers: new Map([["openai", makeFakeCaller()]]), logger: new NoopLogger() });

    factory.registerAdapter(new WebhookAdapter());
    factory.registerResponder(new WebhookResponder());

    const sensor = new WebhookSensor(9999);
    factory.registerSensor(sensor);

    const completed: unknown[] = [];
    factory.getEventBus().on("task:completed", (event) => {
      completed.push(event.payload);
    });

    const startPromise = factory.start();
    await new Promise((r) => setTimeout(r, 50));

    sensor.inject(
      { body: "deploy app", headers: {} },
      { callbackUrl: "https://example.com/callback", requestId: "r1" },
    );

    await new Promise((r) => setTimeout(r, 200));

    await factory.stop();
    await startPromise;

    expect(completed.length).toBeGreaterThanOrEqual(1);
  });
});
