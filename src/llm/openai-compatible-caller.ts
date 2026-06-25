import OpenAI from "openai";
import type { DiscoveredModel, Provider } from "../core/types.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../core/interfaces.js";
import { LLMCaller } from "../core/llm-caller.js";

export class OpenAICompatibleCaller extends LLMCaller implements ILLMCaller {
  private client: OpenAI;
  readonly provider: Provider;
  private providerName: Provider;

  constructor(baseURL: string, apiKey: string, providerName: Provider) {
    super();
    this.provider = providerName;
    this.providerName = providerName;
    this.client = new OpenAI({ baseURL, apiKey });
  }

  async call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult> {
    const startedAt = Date.now();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    try {
      const response = await this.client.chat.completions.create(
        {
          model: options.model,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stop: options.stopSequences,
        },
        { timeout: options.timeoutMs ?? 60_000 },
      );

      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? "",
        usage: this.buildUsage(
          response.usage?.prompt_tokens ?? 0,
          response.usage?.completion_tokens ?? 0,
        ),
        model: response.model,
        provider: this.providerName,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      throw this.wrapError(
        err,
        `call failed for model ${options.model} at ${this.client.baseURL}`,
      );
    }
  }

  estimateTokens(prompt: string, _model: string): number {
    return Math.ceil(prompt.length / 4);
  }

  async listModels(): Promise<DiscoveredModel[]> {
    try {
      const response = await this.client.models.list();
      return response.data.map((m) => ({
        provider: this.providerName,
        modelId: m.id,
        ownedBy: m.owned_by,
      }));
    } catch (err) {
      throw this.wrapError(err, `listModels failed at ${this.client.baseURL}`);
    }
  }

  private wrapError(err: unknown, context: string): Error {
    const base = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error ? err : undefined;
    const wrapped = new Error(`${context}: ${base}`);
    wrapped.cause = cause;
    return wrapped;
  }
}

export function createOllamaCaller(
  baseURL: string = "http://localhost:11434/v1",
  apiKey: string = "ollama",
): OpenAICompatibleCaller {
  return new OpenAICompatibleCaller(baseURL, apiKey, "ollama");
}

export function createOmlxCaller(
  baseURL: string = "http://localhost:8000/v1",
  apiKey: string = "omlx",
): OpenAICompatibleCaller {
  return new OpenAICompatibleCaller(baseURL, apiKey, "omlx");
}

export function createMistralCaller(apiKey: string): OpenAICompatibleCaller {
  return new OpenAICompatibleCaller(
    "https://api.mistral.ai/v1",
    apiKey,
    "mistral",
  );
}

export function createGroqCaller(apiKey: string): OpenAICompatibleCaller {
  return new OpenAICompatibleCaller(
    "https://api.groq.com/openai/v1",
    apiKey,
    "groq",
  );
}

export function createDeepseekCaller(apiKey: string): OpenAICompatibleCaller {
  return new OpenAICompatibleCaller(
    "https://api.deepseek.com/v1",
    apiKey,
    "deepseek",
  );
}
