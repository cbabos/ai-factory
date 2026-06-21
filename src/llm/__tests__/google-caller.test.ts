import { describe, it, expect, vi, type MockedFunction } from "vitest";
import { GoogleCaller } from "../google-caller.js";

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
let constructorArgs: { baseURL?: string; apiKey?: string } | undefined;

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
      constructor(args: { baseURL?: string; apiKey?: string }) {
        fakeClient = this as unknown as FakeOpenAI;
        constructorArgs = args;
      }
    },
  };
});

describe("GoogleCaller", () => {
  it("targets the Gemini OpenAI-compatible endpoint", () => {
    new GoogleCaller("gemini-key");
    expect(constructorArgs?.baseURL).toBe("https://generativelanguage.googleapis.com/v1beta/openai/");
    expect(constructorArgs?.apiKey).toBe("gemini-key");
  });

  it("calls chat.completions.create", async () => {
    const caller = new GoogleCaller("gemini-key");
    fakeClient.chat.completions.create.mockResolvedValue({
      model: "gemini-flash-2.5",
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    });

    const result = await caller.call("hi", { model: "gemini-flash-2.5", provider: "google" });
    expect(result.content).toBe("ok");
    expect(result.provider).toBe("google");
    expect(result.usage).toEqual({ input: 4, output: 2, total: 6 });
  });

  it("lists models with google provider", async () => {
    const caller = new GoogleCaller("gemini-key");
    fakeClient.models.list.mockResolvedValue({
      data: [{ id: "gemini-flash-2.5", owned_by: "google" }],
    });

    const models = await caller.listModels();
    expect(models).toEqual([{ provider: "google", modelId: "gemini-flash-2.5", ownedBy: "google" }]);
  });

  it("inherits estimateTokens behavior", () => {
    const caller = new GoogleCaller("gemini-key");
    expect(caller.estimateTokens("abcdefgh", "gemini-flash-2.5")).toBe(2);
  });
});
