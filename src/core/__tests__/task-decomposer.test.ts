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

function makeRawCaller(content: string): ILLMCaller {
  return {
    provider: "openai",
    call: vi.fn().mockResolvedValue({
      content,
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

function makeSequenceCaller(contents: string[]): ILLMCaller {
  return {
    provider: "openai",
    call: vi.fn().mockImplementation(async () => {
      const next = contents.shift();
      if (next === undefined) {
        throw new Error("No more mocked responses");
      }
      return {
        content: next,
        usage: { input: 100, output: 50, total: 150 },
        model: "gpt-4o-mini",
        provider: "openai",
        latencyMs: 1,
      };
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

  it("uses the provided curated capability tag vocabulary in the prompt", async () => {
    const caller = makeCaller({
      subTasks: [
        {
          description: "implement MCP server",
          capabilityTags: ["mcp", "execution"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    });

    const decomposer = new TaskDecomposer(
      caller,
      "gpt-4o-mini",
      () => ["mcp", "execution", "analysis"],
    );
    await decomposer.decompose(makeTask("build an mcp integration"), makeScore());

    const prompt = getCallMock(caller).mock.calls[0]?.[0];
    expect(prompt).toContain("curated set: [mcp, execution, analysis]");
    expect(prompt).not.toContain("search, codebase, read-only");
    expect(prompt).toContain('The top-level JSON value must be an object, not an array.');
    expect(prompt).toContain('Do not add extra keys such as "title", "name", "description_code", "notes", or "metadata".');
    expect(prompt).toContain('Use "confidence", never variants like "conf", "rating", or numeric keys such as "5".');
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

  it("accepts JSON wrapped in markdown fences", async () => {
    const caller = makeRawCaller(`\`\`\`json
{
  "subTasks": [
    {
      "description": "search",
      "capabilityTags": ["search"],
      "dependencies": [],
      "complexity": {
        "score": 3,
        "confidence": 0.9,
        "reasoning": "ok",
        "estimatedTokens": { "min": 10, "expected": 20, "max": 30 }
      }
    }
  ]
}
\`\`\``);

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.subTasks).toHaveLength(1);
    expect(result.subTasks[0]?.description).toBe("search");
  });

  it("accepts a top-level array of sub-tasks from the model", async () => {
    const caller = makeRawCaller(JSON.stringify([
      {
        description: "search",
        capabilityTags: ["search"],
        dependencies: [],
        complexity: {
          score: 3,
          confidence: 0.9,
          reasoning: "ok",
          estimatedTokens: { min: 10, expected: 20, max: 30 },
        },
      },
      {
        description: "analyze",
        capabilityTags: ["analysis"],
        dependencies: [0],
        complexity: {
          score: 4,
          confidence: 0.85,
          reasoning: "follow-up",
          estimatedTokens: { min: 20, expected: 40, max: 60 },
        },
      },
    ]));

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.subTasks).toHaveLength(2);
    expect(result.subTasks[0]?.description).toBe("search");
    expect(result.subTasks[1]?.dependencies).toEqual(["t1-sub-0"]);
  });

  it("still rejects malformed subtasks after normalizing a top-level array", async () => {
    const caller = makeRawCaller(JSON.stringify([
      {
        description: "search",
        capabilityTags: ["search"],
        dependencies: [],
        complexity: {
          score: 3,
          reasoning: "missing confidence",
          estimatedTokens: { min: 10, expected: 20, max: 30 },
        },
      },
    ]));

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");

    await expect(decomposer.decompose(makeTask("find"), makeScore())).rejects.toThrow(
      "Sub-task 0 complexity.confidence must be a number",
    );
  });

  it("rejects unsupported capability tags", async () => {
    const caller = makeRawCaller(JSON.stringify({
      subTasks: [
        {
          description: "write tests",
          capabilityTags: ["testing"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    }));

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");

    await expect(decomposer.decompose(makeTask("find"), makeScore())).rejects.toThrow(
      "unsupported capability tags: testing",
    );
  });

  it("rejects dependencies on future sub-tasks", async () => {
    const caller = makeRawCaller(JSON.stringify({
      subTasks: [
        {
          description: "implement routes",
          capabilityTags: ["execution"],
          dependencies: [1],
          complexity: makeScore(),
        },
        {
          description: "create auth middleware",
          capabilityTags: ["code-generation"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    }));

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");

    await expect(decomposer.decompose(makeTask("find"), makeScore())).rejects.toThrow(
      "depends on future sub-task 1",
    );
  });

  it("retries when the first decomposition response contains malformed JSON", async () => {
    const caller = makeSequenceCaller([
      "{\"subTasks\":[{\"description\":\"broken\"",
      JSON.stringify({
        subTasks: [
          {
            description: "search",
            capabilityTags: ["search"],
            dependencies: [],
            complexity: makeScore(),
          },
        ],
      }),
    ]);

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.subTasks).toHaveLength(1);
    expect(getCallMock(caller).mock.calls).toHaveLength(2);
    expect(result.conversation.some((turn) => turn.metadata?.phase === "decomposition-retry")).toBe(true);
  });

  it("repairs malformed JSON after retries are exhausted", async () => {
    const repaired = JSON.stringify({
      subTasks: [
        {
          description: "search",
          capabilityTags: ["search"],
          dependencies: [],
          complexity: makeScore(),
        },
      ],
    });
    const caller = makeSequenceCaller([
      "{\"subTasks\":[{\"description\":\"broken\"",
      "{\"subTasks\":[{\"description\":\"still broken\"",
      repaired,
    ]);

    const decomposer = new TaskDecomposer(caller, "gpt-4o-mini");
    const result = await decomposer.decompose(makeTask("find"), makeScore());

    expect(result.subTasks).toHaveLength(1);
    expect(getCallMock(caller).mock.calls).toHaveLength(3);
    expect(result.conversation.some((turn) => turn.metadata?.phase === "decomposition-repair")).toBe(true);
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
