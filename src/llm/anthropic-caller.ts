import Anthropic from "@anthropic-ai/sdk";
import type { DiscoveredModel } from "../core/types.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../core/interfaces.js";
import { LLMCaller } from "../core/llm-caller.js";

export class AnthropicCaller extends LLMCaller implements ILLMCaller {
  readonly provider = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult> {
    const startedAt = Date.now();

    const response = await this.client.messages.create({
      model: options.model,
      system: options.systemPrompt,
      messages: [{ role: "user", content: prompt }],
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      stop_sequences: options.stopSequences,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      content: text,
      usage: this.buildUsage(
        response.usage.input_tokens,
        response.usage.output_tokens,
      ),
      model: response.model,
      provider: "anthropic",
      latencyMs: Date.now() - startedAt,
    };
  }

  estimateTokens(prompt: string, _model: string): number {
    return Math.ceil(prompt.length / 4);
  }

  async listModels(): Promise<DiscoveredModel[]> {
    const response = await this.client.beta.models.list();
    const models: DiscoveredModel[] = [];

    for await (const model of response) {
      models.push({
        provider: "anthropic",
        modelId: model.id,
        ownedBy: model.display_name ?? "anthropic",
      });
    }

    return models;
  }
}
