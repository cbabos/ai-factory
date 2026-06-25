import type {
  ILLMCaller,
  LLMCallOptions,
  LLMCallResult,
} from "./interfaces.js";
import type { DiscoveredModel, Provider } from "./types.js";

export class RoutingLLMCaller implements ILLMCaller {
  readonly provider: Provider;

  private readonly callers: Map<Provider, ILLMCaller>;

  constructor(callers: Map<Provider, ILLMCaller>) {
    const firstProvider = callers.keys().next().value;
    if (!firstProvider) {
      throw new Error("RoutingLLMCaller requires at least one provider");
    }

    this.provider = firstProvider;
    this.callers = callers;
  }

  async call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult> {
    return this.getCaller(options.provider).call(prompt, options);
  }

  async callStructured<T>(
    prompt: string,
    options: LLMCallOptions,
    schema: object,
  ): Promise<T> {
    return this.getCaller(options.provider).callStructured<T>(prompt, options, schema);
  }

  estimateTokens(prompt: string, model: string): number {
    return this.callers.values().next().value!.estimateTokens(prompt, model);
  }

  async listModels(): Promise<DiscoveredModel[]> {
    const discovered = await Promise.all(
      [...this.callers.values()].map((caller) => caller.listModels()),
    );
    return discovered.flat();
  }

  private getCaller(provider: string): ILLMCaller {
    const caller = this.callers.get(provider as Provider);
    if (!caller) {
      throw new Error(`No LLM caller configured for provider ${provider}`);
    }
    return caller;
  }
}
