import { describe, expect, it, vi } from "vitest";
import { RoutingLLMCaller } from "../routing-llm-caller.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../interfaces.js";
import type { Provider } from "../types.js";

function makeCaller(provider: Provider): {
  caller: ILLMCaller;
  callMock: ReturnType<typeof vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>>;
} {
  const callMock = vi.fn<(prompt: string, options: LLMCallOptions) => Promise<LLMCallResult>>()
    .mockResolvedValue({
      content: `${provider}-result`,
      usage: { input: 1, output: 1, total: 2 },
      model: `${provider}-model`,
      provider,
      latencyMs: 1,
    });

  return {
    caller: {
      provider,
      call: callMock,
      callStructured: vi.fn().mockResolvedValue({ provider }),
      estimateTokens: vi.fn().mockReturnValue(1),
      listModels: vi.fn().mockResolvedValue([{ provider, modelId: `${provider}-model`, ownedBy: "test" }]),
    },
    callMock,
  };
}

describe("RoutingLLMCaller", () => {
  it("dispatches calls by provider", async () => {
    const openai = makeCaller("openai");
    const anthropic = makeCaller("anthropic");
    const caller = new RoutingLLMCaller(new Map([
      ["openai", openai.caller],
      ["anthropic", anthropic.caller],
    ]));

    const result = await caller.call("hello", {
      model: "claude",
      provider: "anthropic",
    });

    expect(result.provider).toBe("anthropic");
    expect(anthropic.callMock).toHaveBeenCalledOnce();
    expect(openai.callMock).not.toHaveBeenCalled();
  });
});
