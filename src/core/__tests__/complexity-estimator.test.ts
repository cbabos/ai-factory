import { describe, it, expect, vi, type Mock } from "vitest";
import { ComplexityEstimator } from "../complexity-estimator.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../interfaces.js";
import type { Task, TokenEstimate } from "../types.js";

type CallMock = Mock<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>;

function makeTask(description: string): Task {
  return {
    id: "t1",
    description,
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

function makeCaller(returnValue: {
  score: number;
  confidence: number;
  reasoning: string;
  estimatedTokens: TokenEstimate;
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

describe("ComplexityEstimator", () => {
  it("returns a normalized complexity score", async () => {
    const caller = makeCaller({
      score: 7.8,
      confidence: 0.95,
      reasoning: "Multiple steps required",
      estimatedTokens: { min: 100, expected: 500, max: 1000 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    const result = await estimator.execute(makeTask("analyze codebase"));

    expect(result.score.score).toBe(8);
    expect(result.score.confidence).toBe(0.95);
    expect(result.score.reasoning).toBe("Multiple steps required");
    expect(result.score.estimatedTokens).toEqual({ min: 100, expected: 500, max: 1000 });
  });

  it("clamps score and confidence to valid ranges", async () => {
    const caller = makeCaller({
      score: 15,
      confidence: 1.5,
      reasoning: "Out of range",
      estimatedTokens: { min: -10, expected: -5, max: -1 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    const result = await estimator.execute(makeTask("huge task"));

    expect(result.score.score).toBe(10);
    expect(result.score.confidence).toBe(1);
    expect(result.score.estimatedTokens).toEqual({ min: 0, expected: 0, max: 0 });
  });

  it("normalizes estimated tokens", async () => {
    const caller = makeCaller({
      score: 5,
      confidence: 0.8,
      reasoning: "ok",
      estimatedTokens: { min: 200, expected: 100, max: 50 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    const result = await estimator.execute(makeTask("task"));

    expect(result.score.estimatedTokens).toEqual({ min: 200, expected: 200, max: 200 });
  });

  it("passes correct options to the LLM caller", async () => {
    const caller = makeCaller({
      score: 3,
      confidence: 0.9,
      reasoning: "simple",
      estimatedTokens: { min: 10, expected: 20, max: 30 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    await estimator.execute(makeTask("simple lookup"));

    const callArgs = getCallMock(caller).mock.calls[0];
    const options = callArgs?.[1] as LLMCallOptions;
    expect(options.model).toBe("gpt-4o-mini");
    expect(options.temperature).toBe(0.1);
    expect(options.maxTokens).toBe(600);
    expect(options.responseFormat).toBe("json");
  });

  it("uses the prompt with task details", async () => {
    const caller = makeCaller({
      score: 3,
      confidence: 0.9,
      reasoning: "simple",
      estimatedTokens: { min: 10, expected: 20, max: 30 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    await estimator.execute(makeTask("simple lookup"));

    const callArgs = getCallMock(caller).mock.calls[0];
    const prompt = callArgs?.[0] as string;
    expect(prompt).toContain("simple lookup");
    expect(prompt).toContain('"score": number');
  });

  it("includes a conversation log", async () => {
    const caller = makeCaller({
      score: 3,
      confidence: 0.9,
      reasoning: "simple",
      estimatedTokens: { min: 10, expected: 20, max: 30 },
    });
    const estimator = new ComplexityEstimator(caller, "gpt-4o-mini");
    const result = await estimator.execute(makeTask("simple lookup"));

    expect(result.conversation.length).toBeGreaterThanOrEqual(3);
    expect(result.conversation[0]?.role).toBe("system");
    expect(result.conversation[1]?.role).toBe("user");
    expect(result.conversation[2]?.role).toBe("model");
  });
});
