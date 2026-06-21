import { describe, it, expect, vi, type Mock } from "vitest";
import {
  SearchAgent,
  AnalysisAgent,
  SummarizerAgent,
  ExecutorAgent,
  FileIOAgent,
} from "../index.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../../core/interfaces.js";
import type { SubTask, TaskResult } from "../../core/types.js";

type CallerMock = {
  caller: ILLMCaller;
  callMock: Mock<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>;
};

function makeSubTask(id = "s1", tags: string[] = ["search"]): SubTask {
  return {
    id,
    parentTaskId: "t1",
    description: "find the config loader",
    context: { repo: "ai-factory" },
    dependencies: [],
    capabilityTags: tags,
    complexity: {
      score: 3,
      confidence: 0.9,
      reasoning: "ok",
      estimatedTokens: { min: 100, max: 500, expected: 250 },
    },
    priority: "normal",
    assignedModel: {
      provider: "openai",
      modelId: "gpt-4o-mini",
      estimatedTokens: { min: 100, max: 500, expected: 250 },
      estimatedCost: 0.001,
    },
  };
}

function makeMockCaller(result: Partial<LLMCallResult> = {}): CallerMock {
  const callMock = vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>().mockResolvedValue({
    content: "mock output",
    usage: { input: 10, output: 10, total: 20 },
    model: "gpt-4o-mini",
    provider: "openai",
    latencyMs: 5,
    ...result,
  });
  return {
    caller: {
      call: callMock,
      callStructured: vi.fn(),
      estimateTokens: vi.fn().mockReturnValue(10),
      listModels: vi.fn(),
    },
    callMock,
  };
}

describe("Agent base behavior", () => {
  it("returns failure when no model is assigned", async () => {
    const { caller } = makeMockCaller();
    const agent = new SearchAgent(caller);
    const subTask = { ...makeSubTask(), assignedModel: undefined };
    const result = await agent.execute(subTask);
    expect(result.success).toBe(false);
    expect(result.error).toBe("No model assigned to sub-task");
  });

  it("calls the LLM and returns a successful result", async () => {
    const { caller, callMock } = makeMockCaller({ content: "found config-loader.ts" });
    const agent = new SearchAgent(caller);
    const result = await agent.execute(makeSubTask());

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ findings: "found config-loader.ts" });
    expect(result.modelUsed.modelId).toBe("gpt-4o-mini");
    expect(result.actualTokens).toEqual({ input: 10, output: 10, total: 20 });
    expect(result.retries).toBe(0);

    expect(callMock).toHaveBeenCalledOnce();
    const callArgs = callMock.mock.calls[0];
    const options = callArgs?.[1] as unknown as Record<string, unknown>;
    expect(options.model).toBe("gpt-4o-mini");
    expect(options.maxTokens).toBe(2000);
  });

  it("retries on failure and falls back when available", async () => {
    const fallbackResult: TaskResult = {
      subTaskId: "s1",
      output: { findings: "fallback ok" },
      success: true,
      actualTokens: { input: 5, output: 5, total: 10 },
      actualCost: 0.0005,
      modelUsed: {
        provider: "anthropic",
        modelId: "claude-haiku",
        estimatedTokens: { min: 100, max: 500, expected: 250 },
        estimatedCost: 0.0005,
      },
      latencyMs: 5,
      retries: 1,
    };

    const { caller, callMock } = makeMockCaller();
    callMock
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        content: JSON.stringify(fallbackResult.output),
        usage: fallbackResult.actualTokens,
        model: fallbackResult.modelUsed.modelId,
        provider: fallbackResult.modelUsed.provider,
        latencyMs: fallbackResult.latencyMs,
      });

    const agent = new SearchAgent(caller);
    const subTask = makeSubTask();
    subTask.assignedModel = {
      ...subTask.assignedModel!,
      fallback: fallbackResult.modelUsed,
    };

    const result = await agent.execute(subTask);
    expect(result.success).toBe(true);
    expect(callMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after max retries with no fallback", async () => {
    const { caller, callMock } = makeMockCaller();
    callMock.mockRejectedValue(new Error("persistent error"));

    const agent = new SearchAgent(caller);
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(false);
    expect(result.error).toBe("persistent error");
    expect(result.retries).toBe(1); // no fallback, so only the initial attempt is counted
  });
});

describe("SearchAgent", () => {
  it("builds a search prompt", async () => {
    const { caller, callMock } = makeMockCaller();
    const agent = new SearchAgent(caller);
    await agent.execute(makeSubTask());
    const prompt = callMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Search request:");
    expect(prompt).toContain("find the config loader");
  });

  it("has correct manifest", () => {
    const { caller } = makeMockCaller();
    const agent = new SearchAgent(caller);
    expect(agent.manifest.id).toBe("search-agent");
    expect(agent.manifest.tags).toContain("search");
  });
});

describe("AnalysisAgent", () => {
  it("builds an analysis prompt", async () => {
    const { caller, callMock } = makeMockCaller();
    const agent = new AnalysisAgent(caller);
    await agent.execute(makeSubTask("s1", ["analysis"]));
    const prompt = callMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Analyze:");
  });

  it("wraps raw output in an analysis object", async () => {
    const { caller } = makeMockCaller({ content: "Risk is high." });
    const agent = new AnalysisAgent(caller);
    const result = await agent.execute(makeSubTask("s1", ["analysis"]));
    expect(result.output).toEqual({ analysis: "Risk is high." });
  });
});

describe("SummarizerAgent", () => {
  it("builds a summary prompt", async () => {
    const { caller, callMock } = makeMockCaller();
    const agent = new SummarizerAgent(caller);
    await agent.execute(makeSubTask("s1", ["summarization"]));
    const prompt = callMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Summarize the following into a concise, accurate summary.");
  });

  it("returns a summary object", async () => {
    const { caller } = makeMockCaller({ content: "short summary" });
    const agent = new SummarizerAgent(caller);
    const result = await agent.execute(makeSubTask("s1", ["summarization"]));
    expect(result.output).toEqual({ summary: "short summary" });
  });
});

describe("ExecutorAgent", () => {
  it("builds an execution prompt", async () => {
    const { caller, callMock } = makeMockCaller();
    const agent = new ExecutorAgent(caller);
    await agent.execute(makeSubTask("s1", ["execution"]));
    const prompt = callMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Generate or execute the following. Be precise and safe.");
  });

  it("parses code output", async () => {
    const { caller } = makeMockCaller({ content: "console.log('hi')" });
    const agent = new ExecutorAgent(caller);
    const result = await agent.execute(makeSubTask("s1", ["execution"]));
    expect(result.output).toEqual({ code: "console.log('hi')" });
  });
});

describe("FileIOAgent", () => {
  it("builds a file-io prompt", async () => {
    const { caller, callMock } = makeMockCaller();
    const agent = new FileIOAgent(caller);
    await agent.execute(makeSubTask("s1", ["file-io"]));
    const prompt = callMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("File operation:");
  });

  it("returns raw output", async () => {
    const { caller } = makeMockCaller({ content: "file contents" });
    const agent = new FileIOAgent(caller);
    const result = await agent.execute(makeSubTask("s1", ["file-io"]));
    expect(result.output).toEqual({ result: "file contents" });
  });
});
