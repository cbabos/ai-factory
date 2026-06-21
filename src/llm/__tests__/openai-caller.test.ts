import { describe, it, expect, vi, type MockedFunction } from "vitest";
import { OpenAICaller } from "../openai-caller.js";

interface FakeOpenAI {
  chat: {
    completions: {
      create: MockedFunction<(args: Record<string, unknown>) => Promise<Record<string, unknown>>>;
    };
  };
  models: {
    list: MockedFunction<() => Promise<{ data: Array<{ id: string; owned_by: string }> }>>;
  };
}

let fakeClient: FakeOpenAI;

vi.mock("openai", () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn(),
        },
      };
      models = {
        list: vi.fn(),
      };
      constructor() {
        fakeClient = this as unknown as FakeOpenAI;
      }
    },
  };
});

describe("OpenAICaller", () => {
  it("calls chat.completions.create and returns normalized result", async () => {
    const caller = new OpenAICaller("test-key");
    fakeClient.chat.completions.create.mockResolvedValue({
      model: "gpt-4o-mini",
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const result = await caller.call("hi", {
      model: "gpt-4o-mini",
      provider: "openai",
      systemPrompt: "sys",
      responseFormat: "json",
    });

    expect(result.content).toBe("hello");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.usage).toEqual({ input: 10, output: 5, total: 15 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const call = fakeClient.chat.completions.create.mock.calls[0];
    const callArgs = call?.[0] as Record<string, unknown>;
    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.response_format).toEqual({ type: "json_object" });
    expect(callArgs.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
  });

  it("uses text response format by default", async () => {
    const caller = new OpenAICaller("test-key");
    fakeClient.chat.completions.create.mockResolvedValue({
      model: "gpt-4o-mini",
      choices: [{ message: { content: "" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    await caller.call("hi", { model: "gpt-4o-mini", provider: "openai" });
    const call = fakeClient.chat.completions.create.mock.calls[0];
    const callArgs = call?.[0] as Record<string, unknown>;
    expect(callArgs.response_format).toBeUndefined();
  });

  it("estimates tokens from character count", () => {
    const caller = new OpenAICaller("test-key");
    expect(caller.estimateTokens("abcd", "gpt-4o-mini")).toBe(1);
    expect(caller.estimateTokens("abcdefgh", "gpt-4o-mini")).toBe(2);
  });

  it("lists models", async () => {
    const caller = new OpenAICaller("test-key");
    fakeClient.models.list.mockResolvedValue({
      data: [
        { id: "gpt-4o", owned_by: "openai" },
        { id: "gpt-4o-mini", owned_by: "openai" },
      ],
    });

    const models = await caller.listModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ provider: "openai", modelId: "gpt-4o", ownedBy: "openai" });
  });

  it("parses structured output", async () => {
    const caller = new OpenAICaller("test-key");
    fakeClient.chat.completions.create.mockResolvedValue({
      model: "gpt-4o-mini",
      choices: [{ message: { content: JSON.stringify({ score: 5 }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    const parsed = await caller.callStructured<{ score: number }>(
      "rate",
      { model: "gpt-4o-mini", provider: "openai" },
      {},
    );
    expect(parsed).toEqual({ score: 5 });
  });
});
