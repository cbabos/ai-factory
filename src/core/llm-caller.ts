import type { DiscoveredModel, TokenUsage } from "./types.js";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "./interfaces.js";

export abstract class LLMCaller implements ILLMCaller {
  abstract call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult>;

  async callStructured<T>(
    prompt: string,
    options: LLMCallOptions,
    _schema: object,
  ): Promise<T> {
    const result = await this.call(prompt, {
      ...options,
      responseFormat: "json",
    });
    return JSON.parse(result.content) as T;
  }

  abstract estimateTokens(prompt: string, model: string): number;

  abstract listModels(): Promise<DiscoveredModel[]>;

  protected buildUsage(inputTokens: number, outputTokens: number): TokenUsage {
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };
  }
}
