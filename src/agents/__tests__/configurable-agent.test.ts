import { describe, expect, it, vi } from "vitest";
import { ConfigurableAgent } from "../configurable-agent.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../../core/interfaces.js";
import type { SubTask } from "../../core/types.js";

function makeSubTask(): SubTask {
  return {
    id: "subtask-1",
    parentTaskId: "task-1",
    description: "Write a release note",
    context: { product: "AI Factory", version: "2.0" },
    dependencies: [],
    capabilityTags: ["writing"],
    complexity: {
      score: 4,
      confidence: 1,
      reasoning: "test",
      estimatedTokens: { min: 50, expected: 150, max: 300 },
    },
    priority: "normal",
    assignedModel: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      estimatedTokens: { min: 50, expected: 150, max: 300 },
      estimatedCost: 0.01,
    },
  };
}

function makeCaller(content: string): {
  caller: ILLMCaller;
  callMock: ReturnType<typeof vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>>;
} {
  const callMock = vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>()
    .mockResolvedValue({
      content,
      usage: { input: 10, output: 20, total: 30 },
      model: "gpt-4o-mini",
      provider: "openai",
      latencyMs: 5,
    });

  return {
    caller: {
      provider: "openai",
      call: callMock,
      callStructured: vi.fn(),
      estimateTokens: vi.fn().mockReturnValue(10),
      listModels: vi.fn(),
    },
    callMock,
  };
}

describe("ConfigurableAgent", () => {
  it("uses metadata-driven prompt and system prompt fields", async () => {
    const { caller, callMock } = makeCaller("Done");
    const agent = new ConfigurableAgent(
      {
        id: "release-agent",
        name: "Release Agent",
        tags: ["writing"],
        complexityMin: 1,
        complexityMax: 8,
        tokenProfileMin: 100,
        tokenProfileTypical: 400,
        tokenProfileMax: 1200,
        timeoutMs: 30000,
        maxRetries: 1,
        description: "Creates polished release communications.",
        metadata: {
          systemPrompt: "You are a release manager.",
          outputContract: "Return a short markdown release note.",
          toolPolicy: "Use tools only for file inspection.",
        },
      },
      caller,
    );

    const result = await agent.execute(makeSubTask());

    expect(result.success).toBe(true);
    expect(result.output).toBe("Done");

    const prompt = callMock.mock.calls[0]?.[0] ?? "";
    const options = callMock.mock.calls[0]?.[1];
    expect(prompt).toContain("Task: Write a release note");
    expect(prompt).toContain("Output contract:");
    expect(prompt).toContain("Return a short markdown release note.");
    expect(options?.systemPrompt).toContain("You are a release manager.");
    expect(options?.systemPrompt).toContain("Tool policy:");
  });

  it("renders prompt templates against subtask fields", async () => {
    const { caller, callMock } = makeCaller("Templated");
    const agent = new ConfigurableAgent(
      {
        id: "templated-agent",
        name: "Templated Agent",
        tags: ["writing"],
        complexityMin: 1,
        complexityMax: 8,
        tokenProfileMin: 100,
        tokenProfileTypical: 400,
        tokenProfileMax: 1200,
        timeoutMs: 30000,
        maxRetries: 1,
        metadata: {
          promptTemplate: "Handle {{subtask.description}} using {{model.provider}} and context {{subtask.context}}",
        },
      },
      caller,
    );

    await agent.execute(makeSubTask());

    const prompt = callMock.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain("Handle Write a release note using openai");
    expect(prompt).toContain('"product": "AI Factory"');
  });

  it("parses JSON output when outputMode is json", async () => {
    const { caller } = makeCaller('{"status":"ok","items":[1,2]}');
    const agent = new ConfigurableAgent(
      {
        id: "json-agent",
        name: "JSON Agent",
        tags: ["analysis"],
        complexityMin: 1,
        complexityMax: 8,
        tokenProfileMin: 100,
        tokenProfileTypical: 400,
        tokenProfileMax: 1200,
        timeoutMs: 30000,
        maxRetries: 1,
        metadata: {
          outputMode: "json",
        },
      },
      caller,
    );

    const result = await agent.execute(makeSubTask());
    expect(result.output).toEqual({ status: "ok", items: [1, 2] });
  });
});
