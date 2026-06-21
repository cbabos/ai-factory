import { describe, it, expect, vi, type Mock } from "vitest";
import { TaskDecomposer } from "../task-decomposer.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../interfaces.js";
import type { ComplexityScore, Task } from "../types.js";

type CallMock = Mock<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>;

function makeTask(description: string): Task {
  return {
    id: "t1",
    description,
    context: { repo: "ai-factory" },
    origin: {
      channel: "webhook",
      replyTo: "",
      messageId: "",
      rawPayload: {},
    },
    priority: "high",
    createdAt: Date.now(),
  };
}

function makeScore(): ComplexityScore {
  return {
    score: 7,
    confidence: 0.9,
    reasoning: "Multi-step",
    estimatedTokens: { min: 100, expected: 500, max: 1000 },
  };
}

function makeCaller(returnValue: {
  subTasks: Array<{
    description: string;
    capabilityTags: string[];
    dependencies: number[];
    complexity: ComplexityScore;
  }>;
}): ILLMCaller {
  return {
    provider: "openai",
    call: vi.fn().mockResolvedValue({
      content: JSON.stringify(returnValue),
      usage: { input: 100, output: 50, total: 150 },
      model: "gpt-4o-mini",
      provider: "openai",
      latencyMs: 1,
    }) as ILLMCaller["call"],
    callStructured: vi.fn(),
    estimateTokens: vi.fn().mockReturnValue(100),
    listModels: vi.fn(),
  };
}

function getCallMock(caller: ILLMCaller): CallMock {
  return caller.call as unknown as CallMock;
}

describe("TaskDecomposer", () => {
  it("decomposes a task into sub-tasks with mapped ids", async () => {
    const caller = makeCaller({
      subTasks: [
        {
          description: "search",
          capabilityTags: ["search"],
          dependencies: [],
          complexity: makeScore(),
        },
        {
          description: "analyze",
          capabilityTags: ["analysis"],
          dependencies: [0],
          complexity: makeScore(),
        },
      ],
    });

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find and analyze"), makeScore());

    expect(result.subTasks).toHaveLength(2);
    expect(result.subTasks[0]?.id).toBe("t1-sub-0");
    expect(result.subTasks[1]?.id).toBe("t1-sub-1");
    expect(result.subTasks[1]?.dependencies).toEqual(["t1-sub-0"]);
    expect(result.subTasks[0]?.parentTaskId).toBe("t1");
    expect(result.subTasks[0]?.priority).toBe("high");
  });

  it("passes correct options to the LLM caller", async () => {
    const caller = makeCaller({
      subTasks: [
        {
          description: "search",
          capabilityTags: ["search"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    });

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    await decomposer.decompose(makeTask("find"), makeScore());

    const callArgs = getCallMock(caller).mock.calls[0];
    const options = callArgs?.[1] as unknown as Record<string, unknown>;
    expect(options.model).toBe("gpt-4o-mini");
    expect(options.temperature).toBe(0.2);
    expect(options.maxTokens).toBe(2000);
    expect(options.responseFormat).toBe("json");
  });

  it("normalizes complexity scores and token estimates", async () => {
    const caller = makeCaller({
      subTasks: [
        {
          description: "search",
          capabilityTags: ["search"],
          dependencies: [],
          complexity: {
            score: 12,
            confidence: 1.2,
            reasoning: "ok",
            estimatedTokens: { min: 50, expected: 30, max: 20 },
          },
        },
      ],
    });

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.subTasks[0]?.complexity.score).toBe(10);
    expect(result.subTasks[0]?.complexity.confidence).toBe(1);
    expect(result.subTasks[0]?.complexity.estimatedTokens).toEqual({ min: 50, expected: 50, max: 50 });
  });

  it("includes a conversation log", async () => {
    const caller = makeCaller({
      subTasks: [
        {
          description: "search",
          capabilityTags: ["search"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    });

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.conversation.length).toBeGreaterThanOrEqual(3);
    expect(result.conversation[0]?.role).toBe("system");
    expect(result.conversation[1]?.role).toBe("user");
    expect(result.conversation[2]?.role).toBe("model");
  });
});
