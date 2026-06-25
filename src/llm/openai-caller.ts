import OpenAI from "openai";
import type { DiscoveredModel } from "../core/types.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../core/interfaces.js";
import { LLMCaller } from "../core/llm-caller.js";

export class OpenAICaller extends LLMCaller implements ILLMCaller {
  readonly provider = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult> {
    const startedAt = Date.now();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await this.client.chat.completions.create(
      {
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format:
          options.responseFormat === "json"
            ? { type: "json_object" }
            : undefined,
        stop: options.stopSequences,
      },
      {
        timeout: options.timeoutMs,
      },
    );

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? "",
      usage: this.buildUsage(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
      ),
      model: response.model,
      provider: "openai",
      latencyMs: Date.now() - startedAt,
    };
  }

  estimateTokens(prompt: string, _model: string): number {
    return Math.ceil(prompt.length / 4);
  }

  async listModels(): Promise<DiscoveredModel[]> {
    const response = await this.client.models.list();
    return response.data.map((m) => ({
      provider: "openai" as const,
      modelId: m.id,
      ownedBy: m.owned_by,
    }));
  }
}
