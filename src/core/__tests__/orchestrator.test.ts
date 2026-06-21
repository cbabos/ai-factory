import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { EventBus } from "../event-bus.js";
import { Tracer } from "../tracer.js";
import { BudgetTracker } from "../budget-tracker.js";
import type {
  Task,
  SubTask,
  TaskResult,
  FinalResult,
  ComplexityScore,
  ModelChoice,
  BudgetState,
  ConversationTurn,
} from "../types.js";
import type {
  IComplexityEstimator,
  ITaskDecomposer,
  IModelSelector,
  IDispatcher,
  IAggregator,
  EstimationResult,
  DecompositionResult,
} from "../interfaces.js";

function makeTask(): Task {
  return {
    id: "t1",
    description: "do something",
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

function makeScore(score: number): ComplexityScore {
  return {
    score,
    confidence: 0.9,
    reasoning: "ok",
    estimatedTokens: { min: 10, expected: 50, max: 100 },
  };
}

function makeModelChoice(modelId: string): ModelChoice {
  return {
    provider: "openai",
    modelId,
    estimatedTokens: { min: 10, expected: 50, max: 100 },
    estimatedCost: 0.001,
  };
}

function makeResult(subTaskId: string, success = true): TaskResult {
  return {
    subTaskId,
    output: success ? { ok: true } : null,
    success,
    actualTokens: { input: 5, output: 5, total: 10 },
    actualCost: 0.001,
    modelUsed: makeModelChoice("gpt-4o-mini"),
    latencyMs: 10,
    retries: 0,
  };
}

function makeDeps(overrides: {
  score?: number;
  subTasks?: SubTask[];
  results?: TaskResult[];
  final?: FinalResult;
} = {}) {
  const eventBus = new EventBus();
  const tracer = new Tracer();
  const budgetTracker = new BudgetTracker(eventBus);
  budgetTracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
  budgetTracker.initialize(["openai"]);

  const score = makeScore(overrides.score ?? 3);
  const subTasks =
    overrides.subTasks ??
    ([
      {
        id: "t1-direct",
        parentTaskId: "t1",
        description: "do something",
        context: {},
        dependencies: [],
        capabilityTags: [],
        complexity: score,
        priority: "normal" as const,
      },
    ] as SubTask[]);

  const results = overrides.results ?? [makeResult("t1-direct")];

  const final: FinalResult =
    overrides.final ??
    ({
      taskId: "t1",
      output: [{ ok: true }],
      success: true,
      subResults: results,
      totalTokens: { input: 5, output: 5, total: 10 },
      totalCost: 0.001,
      totalLatencyMs: 10,
      modelBreakdown: {},
    } as FinalResult);

  const conversation: ConversationTurn[] = [
    { role: "system", content: "sys", timestamp: 1 },
    { role: "user", content: "prompt", timestamp: 2 },
    { role: "model", content: JSON.stringify(score), timestamp: 3 },
  ];
  const estimationResult: EstimationResult = { score, conversation };

  const estimator = {
    name: "ComplexityEstimator",
    execute: vi.fn().mockResolvedValue(estimationResult),
    setContext: vi.fn(),
  } as unknown as IComplexityEstimator;

  const decomposer: ITaskDecomposer = {
    decompose: vi.fn().mockResolvedValue({ subTasks, conversation } satisfies DecompositionResult),
  };

  const modelSelector = {
    select: vi.fn().mockImplementation(async (st: SubTask) => {
      const choice: ModelChoice = {
        provider: "openai",
        modelId: "gpt-4o-mini",
        estimatedTokens: st.complexity.estimatedTokens,
        estimatedCost: 0.001,
      };
      return choice;
    }),
  } as unknown as IModelSelector;

  const dispatcher = {
    name: "Dispatcher",
    execute: vi.fn().mockResolvedValue(results),
    setContext: vi.fn(),
  } as unknown as IDispatcher;

  const aggregator: IAggregator = {
    aggregate: vi.fn().mockReturnValue(final),
  };

  return {
    estimator,
    decomposer,
    modelSelector,
    dispatcher,
    aggregator,
    budgetTracker,
    eventBus,
    tracer,
  };
}

describe("Orchestrator", () => {
  it("runs the full pipeline for simple tasks (no decomposition)", async () => {
    const deps = makeDeps({ score: 3 });
    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    const result = await orchestrator.execute(makeTask());

    expect(result.success).toBe(true);
    expect(deps.estimator.execute).toHaveBeenCalledOnce();
    expect(deps.decomposer.decompose).not.toHaveBeenCalled();
    expect(deps.dispatcher.execute).toHaveBeenCalledOnce();
    expect(deps.aggregator.aggregate).toHaveBeenCalledOnce();
  });

  it("decomposes complex tasks", async () => {
    const subTasks: SubTask[] = [
      {
        id: "t1-sub-0",
        parentTaskId: "t1",
        description: "step 1",
        context: {},
        dependencies: [],
        capabilityTags: ["search"],
        complexity: makeScore(4),
        priority: "normal",
      },
      {
        id: "t1-sub-1",
        parentTaskId: "t1",
        description: "step 2",
        context: {},
        dependencies: ["t1-sub-0"],
        capabilityTags: ["analysis"],
        complexity: makeScore(4),
        priority: "normal",
      },
    ];

    const deps = makeDeps({ score: 7, subTasks });
    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    await orchestrator.execute(makeTask());
    expect(deps.decomposer.decompose).toHaveBeenCalledOnce();
    expect(deps.dispatcher.execute).toHaveBeenCalledOnce();
  });

  it("assigns models to each sub-task", async () => {
    const subTasks: SubTask[] = [
      {
        id: "t1-sub-0",
        parentTaskId: "t1",
        description: "step 1",
        context: {},
        dependencies: [],
        capabilityTags: ["search"],
        complexity: makeScore(3),
        priority: "normal",
      },
    ];

    const deps = makeDeps({ score: 6, subTasks });
    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    await orchestrator.execute(makeTask());
    expect(deps.modelSelector.select).toHaveBeenCalledTimes(1);
  });

  it("emits task lifecycle events", async () => {
    const deps = makeDeps();
    const handler = vi.fn();
    deps.eventBus.on("task:created", handler);
    deps.eventBus.on("task:completed", handler);

    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    await orchestrator.execute(makeTask());
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("returns a failure result when the pipeline throws", async () => {
    const deps = makeDeps();
    deps.estimator.execute = vi.fn().mockRejectedValue(new Error("estimator boom"));

    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    const result = await orchestrator.execute(makeTask());
    expect(result.success).toBe(false);
    expect(result.subResults).toEqual([]);
    expect(result.totalCost).toBe(0);
  });

  it("uses budget tracker states for model selection", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator({
      ...deps,
      decompositionThreshold: 5,
    });

    await orchestrator.execute(makeTask());
    const selectMock = deps.modelSelector.select as unknown as import("vitest").Mock<(st: SubTask, budget: BudgetState[]) => Promise<ModelChoice>>;
    const selectCall = selectMock.mock.calls[0];
    const budgetStates = selectCall?.[1] as BudgetState[];
    expect(budgetStates).toHaveLength(1);
    expect(budgetStates[0]?.provider).toBe("openai");
  });
});
