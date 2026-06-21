import { describe, it, expect, vi, type MockedFunction } from "vitest";
import { AnthropicCaller } from "../anthropic-caller.js";

interface FakeAnthropic {
  messages: {
    create: MockedFunction<(args: Record<string, unknown>) => Promise<Record<string, unknown>>>;
  };
  beta: {
    models: {
      list: MockedFunction<() => AsyncIterable<{ id: string; display_name?: string }>>;
    };
  };
}

let fakeClient: FakeAnthropic;

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        create: vi.fn(),
      };
      beta = {
        models: {
          list: vi.fn(),
        },
      };
      constructor() {
        fakeClient = this as unknown as FakeAnthropic;
      }
    },
  };
});

async function* modelGenerator() {
  yield { id: "claude-3-opus", display_name: "Claude 3 Opus" };
  yield { id: "claude-3-haiku", display_name: "Claude 3 Haiku" };
}

describe("AnthropicCaller", () => {
  it("calls messages.create and returns normalized result", async () => {
    const caller = new AnthropicCaller("test-key");
    fakeClient.messages.create.mockResolvedValue({
      model: "claude-3-haiku",
      content: [{ type: "text", text: "hello" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await caller.call("hi", {
      model: "claude-3-haiku",
      provider: "anthropic",
      systemPrompt: "sys",
      maxTokens: 1024,
    });

    expect(result.content).toBe("hello");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-3-haiku");
    expect(result.usage).toEqual({ input: 10, output: 5, total: 15 });

    const call = fakeClient.messages.create.mock.calls[0];
    const callArgs = call?.[0] as Record<string, unknown>;
    expect(callArgs.model).toBe("claude-3-haiku");
    expect(callArgs.system).toBe("sys");
    expect(callArgs.max_tokens).toBe(1024);
  });

  it("defaults max_tokens", async () => {
    const caller = new AnthropicCaller("test-key");
    fakeClient.messages.create.mockResolvedValue({
      model: "claude-3-haiku",
      content: [{ type: "text", text: "" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    await caller.call("hi", { model: "claude-3-haiku", provider: "anthropic" });
    const call = fakeClient.messages.create.mock.calls[0];
    const callArgs = call?.[0] as Record<string, unknown>;
    expect(callArgs.max_tokens).toBe(4096);
  });

  it("estimates tokens from character count", () => {
    const caller = new AnthropicCaller("test-key");
    expect(caller.estimateTokens("abcdefgh", "claude-3-haiku")).toBe(2);
  });

  it("lists models", async () => {
    const caller = new AnthropicCaller("test-key");
    fakeClient.beta.models.list.mockReturnValue(modelGenerator());

    const models = await caller.listModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ provider: "anthropic", modelId: "claude-3-opus", ownedBy: "Claude 3 Opus" });
  });
});
