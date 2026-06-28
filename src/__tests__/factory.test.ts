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
import { ModelSelector } from "../core/model-selector.js";
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

function makeProviderCaller(
  provider: "openai" | "ollama" | "omlx",
  implementation?: (prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>,
): ILLMCaller {
  const call = vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>().mockImplementation(
    implementation ?? (async () => ({
      content: JSON.stringify({
        score: 3,
        confidence: 0.9,
        reasoning: "simple",
        estimatedTokens: { min: 10, expected: 50, max: 100 },
      }),
      usage: { input: 10, output: 10, total: 20 },
      model: provider === "omlx" ? "gemma-4-12B-it-OptiQ-4bit" : `${provider}-model`,
      provider,
      latencyMs: 5,
    })),
  );

  return {
    provider,
    call,
    callStructured: vi.fn().mockImplementation(async () => {
      return JSON.parse((await call("", { model: "", provider })).content);
    }) as ILLMCaller["callStructured"],
    estimateTokens: vi.fn().mockReturnValue(10),
    listModels: vi.fn().mockResolvedValue([
      {
        provider,
        modelId: provider === "omlx" ? "gemma-4-12B-it-OptiQ-4bit" : `${provider}-model`,
        ownedBy: provider,
      },
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
        id: "custom-search",
        tags: ["search", "codebase", "read-only"],
        complexityRange: [1, 4],
        timeoutMs: 30000,
        maxRetries: 2,
      },
      {
        id: "custom-analysis",
        tags: ["analysis", "reasoning"],
        complexityRange: [3, 7],
        timeoutMs: 60000,
        maxRetries: 2,
      },
      {
        id: "custom-summary",
        tags: ["summarization", "synthesis"],
        complexityRange: [1, 5],
        timeoutMs: 30000,
        maxRetries: 1,
      },
      {
        id: "custom-executor",
        tags: ["execution", "code-generation", "write"],
        complexityRange: [3, 8],
        timeoutMs: 120000,
        maxRetries: 1,
      },
      {
        id: "custom-file-io",
        tags: ["file-io", "read-only", "write"],
        complexityRange: [1, 3],
        timeoutMs: 15000,
        maxRetries: 2,
      },
    ],
  };
}

function makeConfigWithoutModels(): FactoryConfig {
  const config = makeConfig();
  return {
    ...config,
    models: [],
  };
}

function makeSecrets(): EnvSecretsProvider {
  return {
    provider: "openai",
    get: (_key: string) => undefined,
  } as EnvSecretsProvider;
}

describe("AIFactory integration", () => {
  it("can bootstrap from an empty config when callers are injected", () => {
    expect(() => new AIFactory({
      config: {},
      secrets: makeSecrets(),
      callers: new Map([["openai", makeFakeCaller()]]),
      logger: new NoopLogger(),
    })).not.toThrow();
  });

  it("can bootstrap callers from env-enabled providers without static models", () => {
    const secrets = {
      get: (key: string) => {
        if (key === "OLLAMA_BASE_URL") {
          return "https://ollama.example.com/v1";
        }
        return undefined;
      },
    };

    expect(() => new AIFactory({
      config: makeConfigWithoutModels(),
      secrets,
      logger: new NoopLogger(),
    })).not.toThrow();
  });

  it("does not activate discovered models until they are explicitly configured", async () => {
    const factory = new AIFactory({
      config: makeConfigWithoutModels(),
      secrets: makeSecrets(),
      callers: new Map([["openai", makeFakeCaller()]]),
      logger: new NoopLogger(),
    });

    await factory.initialize();

    const currentCatalog = (factory as unknown as {
      currentCatalog: Array<{
        provider: string;
        modelId: string;
      }>;
    }).currentCatalog;

    expect(currentCatalog).toEqual([]);
  });

  it("keeps estimator model paired with its provider instead of the first caller", async () => {
    const taskRepository = new InMemoryTaskRepository();
    const ollamaCaller = makeProviderCaller("ollama");
    const omlxCaller = makeProviderCaller("omlx");

    const factory = new AIFactory({
      config: {
        ...makeConfigWithoutModels(),
        complexity: {
          decompositionThreshold: 5,
          estimatorModel: "gemma-4-12B-it-OptiQ-4bit",
        },
        models: [
          {
            provider: "ollama",
            modelId: "ollama-model",
            maxTokens: 8192,
            costPer1kInput: 0,
            costPer1kOutput: 0,
            capabilities: ["analysis"],
          },
          {
            provider: "omlx",
            modelId: "gemma-4-12B-it-OptiQ-4bit",
            maxTokens: 8192,
            costPer1kInput: 0,
            costPer1kOutput: 0,
            capabilities: ["analysis", "execution", "code-generation", "write", "file-io", "read-only", "reasoning", "search", "summarization", "synthesis"],
          },
        ],
      },
      secrets: makeSecrets(),
      callers: new Map([
        ["ollama", ollamaCaller],
        ["omlx", omlxCaller],
      ]),
      logger: new NoopLogger(),
      taskRepository,
    });

    factory.registerAdapter(new CronAdapter());
    factory.registerResponder(new CronResponder());
    const sensor = new CronSensor(50, "status check");
    factory.registerSensor(sensor);

    const startPromise = factory.start();
    await new Promise((r) => setTimeout(r, 250));
    await factory.stop();
    await startPromise;

    expect(omlxCaller.call).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: "gemma-4-12B-it-OptiQ-4bit",
        provider: "omlx",
      }),
    );
    expect(ollamaCaller.call).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: "gemma-4-12B-it-OptiQ-4bit",
      }),
    );
  });

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

  it("refreshes the runtime model catalog after model capability updates", async () => {
    const modelId = `sync-qwen-${Date.now()}`;
    const factory = new AIFactory({
      config: {
        ...makeConfigWithoutModels(),
        complexity: {
          decompositionThreshold: 5,
          estimatorModel: modelId,
        },
        models: [
          {
            provider: "omlx",
            modelId,
            maxTokens: 32768,
            costPer1kInput: 0.001,
            costPer1kOutput: 0.001,
            capabilities: ["code-generation"],
          },
        ],
      },
      secrets: makeSecrets(),
      callers: new Map([["omlx", makeProviderCaller("omlx")]]),
      logger: new NoopLogger(),
      apiServerOptions: { enableSse: false },
    });

    const store = (factory as unknown as {
      modelStore?: {
        update: (provider: string, modelId: string, updates: {
          provider: string;
          modelId: string;
          maxTokens: number;
          costPer1kInput: number;
          costPer1kOutput: number;
          capabilities: string[];
          ownedBy?: string;
          isActive?: boolean;
        }) => unknown;
      };
    }).modelStore;
    expect(store).toBeDefined();

    store!.update("omlx", modelId, {
      provider: "omlx",
      modelId,
      maxTokens: 32768,
      costPer1kInput: 0.001,
      costPer1kOutput: 0.001,
      capabilities: ["code-generation", "data"],
      isActive: true,
    });

    await (factory as unknown as {
      syncRuntimeModels: (event: { action: "upsert"; provider: "omlx"; modelId: string }) => Promise<void>;
      currentCatalog: Array<{
        provider: "omlx";
        modelId: string;
        maxTokens: number;
        costPer1kInput: number;
        costPer1kOutput: number;
        capabilities: string[];
      }>;
    }).syncRuntimeModels({
      action: "upsert",
      provider: "omlx",
      modelId,
    });

    const currentCatalog = (factory as unknown as {
      currentCatalog: Array<{
        provider: "omlx";
        modelId: string;
        maxTokens: number;
        costPer1kInput: number;
        costPer1kOutput: number;
        capabilities: string[];
      }>;
    }).currentCatalog;
    const refreshedModel = currentCatalog.find((model) => model.provider === "omlx" && model.modelId === modelId);

    expect(refreshedModel?.capabilities).toEqual(["code-generation", "data"]);

    const selector = new ModelSelector(currentCatalog);
    const choice = await selector.select(
      {
        id: "sub-1",
        parentTaskId: "task-1",
        description: "Define schema",
        context: {},
        dependencies: [],
        capabilityTags: ["code-generation", "data"],
        complexity: {
          score: 4,
          confidence: 0.9,
          reasoning: "Needs model with both tags",
          estimatedTokens: { min: 10, expected: 50, max: 100 },
        },
        priority: "normal",
      },
      [
        { provider: "omlx", allocated: 10, consumed: 0, remaining: 10, cap: 10, softCap: 8 },
      ],
    );

    expect(choice.provider).toBe("omlx");
    expect(choice.modelId).toBe(modelId);
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

  it("resubmits a failed task as a new pending task", async () => {
    const taskRepository = new InMemoryTaskRepository();
    const factory = new AIFactory({
      config: {},
      secrets: makeSecrets(),
      callers: new Map([["openai", makeFakeCaller()]]),
      logger: new NoopLogger(),
      taskRepository,
    });

    const original = await factory.submitApiTask({
      description: "resubmit candidate",
      priority: "high",
      context: { repo: "ai-factory" },
      workflowId: "custom-workflow",
      workflowVersion: 2,
    });

    await taskRepository.setStatus(original.id, "failed");
    const resubmitted = await factory.resubmitTask(original.id);

    expect(resubmitted.id).not.toBe(original.id);
    expect(resubmitted.description).toBe(original.description);
    expect(resubmitted.priority).toBe("high");
    expect(resubmitted.context.repo).toBe("ai-factory");
    expect(resubmitted.context.resubmittedFrom).toBe(original.id);
    expect(resubmitted.workflow?.workflowId).toBe("custom-workflow");
    expect(resubmitted.workflow?.workflowVersion).toBe(2);

    const record = await taskRepository.get(resubmitted.id);
    expect(record?.status).toBe("pending");
  });

  it("rejects resubmitting a task that is not failed or cancelled", async () => {
    const taskRepository = new InMemoryTaskRepository();
    const factory = new AIFactory({
      config: {},
      secrets: makeSecrets(),
      callers: new Map([["openai", makeFakeCaller()]]),
      logger: new NoopLogger(),
      taskRepository,
    });

    const original = await factory.submitApiTask({ description: "still running" });
    await expect(factory.resubmitTask(original.id)).rejects.toThrow("cannot be resubmitted");
  });

});
