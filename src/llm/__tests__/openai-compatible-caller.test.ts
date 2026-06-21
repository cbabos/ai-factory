import { describe, it, expect, vi, type MockedFunction } from "vitest";
import {
  OpenAICompatibleCaller,
  createOllamaCaller,
  createOmlxCaller,
  createMistralCaller,
  createGroqCaller,
  createDeepseekCaller,
} from "../openai-compatible-caller.js";

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

describe("OpenAICompatibleCaller", () => {
  it("uses provided baseURL, apiKey and provider", async () => {
    const caller = new OpenAICompatibleCaller("https://example.com/v1", "key", "mistral");
    expect(constructorArgs?.baseURL).toBe("https://example.com/v1");
    expect(constructorArgs?.apiKey).toBe("key");

    fakeClient.chat.completions.create.mockResolvedValue({
      model: "mistral-small",
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });

    const result = await caller.call("hi", { model: "mistral-small", provider: "mistral" });
    expect(result.provider).toBe("mistral");
    expect(result.content).toBe("ok");
  });

  it("lists models with the configured provider", async () => {
    const caller = new OpenAICompatibleCaller("https://example.com/v1", "key", "groq");
    fakeClient.models.list.mockResolvedValue({
      data: [{ id: "llama3-8b", owned_by: "groq" }],
    });

    const models = await caller.listModels();
    expect(models).toEqual([{ provider: "groq", modelId: "llama3-8b", ownedBy: "groq" }]);
  });
});

describe("Factory helpers", () => {
  it.each([
    [createOllamaCaller, "http://localhost:11434/v1", "ollama", "ollama"],
    [createOmlxCaller, "http://localhost:8000/v1", "omlx", "omlx"],
    [createMistralCaller, "https://api.mistral.ai/v1", "mistral", "key"],
    [createGroqCaller, "https://api.groq.com/openai/v1", "groq", "key"],
    [createDeepseekCaller, "https://api.deepseek.com/v1", "deepseek", "key"],
  ])(
    "%s configures %s with provider %s",
    (factory, expectedURL, _expectedProvider, apiKey) => {
      const arg = apiKey === "key" ? "key" : (undefined as unknown as string);
      factory(arg);
      expect(constructorArgs?.baseURL).toBe(expectedURL);
      expect(constructorArgs?.apiKey).toBe(apiKey);
    },
  );
});
