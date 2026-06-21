import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "./interfaces.js";
import type { DiscoveredModel } from "./types.js";
import type { ICircuitBreaker } from "./circuit-breaker.js";
import type { IRateLimiter } from "./rate-limiter.js";

export class ResilientLLMCaller implements ILLMCaller {
  constructor(
    private readonly inner: ILLMCaller,
    private readonly breaker: ICircuitBreaker,
    private readonly key: string,
    private readonly rateLimiter?: IRateLimiter,
  ) {}

  async call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult> {
    await this.rateLimiter?.wait(this.key);
    return this.breaker.execute(() => this.inner.call(prompt, options));
  }

  async callStructured<T>(
    prompt: string,
    options: LLMCallOptions,
    schema: object,
  ): Promise<T> {
    await this.rateLimiter?.wait(this.key);
    return this.breaker.execute(() =>
      this.inner.callStructured<T>(prompt, options, schema),
    );
  }

  estimateTokens(prompt: string, model: string): number {
    return this.inner.estimateTokens(prompt, model);
  }

  async listModels(): Promise<DiscoveredModel[]> {
    return this.breaker.execute(() => this.inner.listModels());
  }
}
