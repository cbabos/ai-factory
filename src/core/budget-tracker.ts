import type { BudgetState, FactoryEvent, TokenUsage } from "./types.js";
import type { IBudgetTracker, IEventBus, Subscription } from "./interfaces.js";
import { Configurable } from "./configurable.js";

interface BudgetConfig {
  defaultCap: number;
  softCapRatio: number;
}

export class BudgetTracker extends Configurable<BudgetConfig> implements IBudgetTracker {
  private states = new Map<string, BudgetState>();
  private eventBus: IEventBus;
  private subscription?: Subscription;

  constructor(eventBus: IEventBus) {
    super();
    this.eventBus = eventBus;
  }

  validateConfig(config: BudgetConfig): string[] {
    const errors: string[] = [];
    if (config.defaultCap <= 0) errors.push("defaultCap must be positive");
    if (config.softCapRatio <= 0 || config.softCapRatio > 1) errors.push("softCapRatio must be between 0 and 1");
    return errors;
  }

  initialize(providers: string[]): void {
    this.subscription?.unsubscribe();
    this.states.clear();
    for (const provider of providers) {
      this.states.set(provider, {
        provider: provider as BudgetState["provider"],
        allocated: this.config.defaultCap,
        consumed: 0,
        remaining: this.config.defaultCap,
        cap: this.config.defaultCap,
        softCap: Math.floor(this.config.defaultCap * this.config.softCapRatio),
      });
    }
    this.subscription = this.eventBus.on("token:consumed", this.onTokenConsumed.bind(this));
  }

  getState(provider: string): BudgetState {
    const state = this.states.get(provider);
    if (!state) {
      throw new Error(`No budget state for provider: ${provider}`);
    }
    return { ...state };
  }

  getAllStates(): BudgetState[] {
    return Array.from(this.states.values()).map((s) => ({ ...s }));
  }

  canAfford(provider: string, estimatedTokens: number, estimatedCost: number): boolean {
    const state = this.states.get(provider);
    if (!state) return false;
    return state.remaining >= estimatedCost;
  }

  recordUsage(provider: string, usage: TokenUsage, cost: number): void {
    this.applyUsage(provider, usage.total, cost);
  }

  reset(provider: string): void {
    const state = this.states.get(provider);
    if (!state) return;
    state.consumed = 0;
    state.remaining = state.cap;
  }

  private onTokenConsumed(event: FactoryEvent): void {
    const { provider, tokens, cost } = event.payload as {
      provider: string;
      tokens: number;
      cost: number;
    };
    if (provider && typeof tokens === "number" && typeof cost === "number") {
      this.applyUsage(provider, tokens, cost);
    }
  }

  private applyUsage(provider: string, _tokens: number, cost: number): void {
    const state = this.states.get(provider);
    if (!state) return;

    state.consumed += cost;
    state.remaining = state.cap - state.consumed;

    if (state.remaining <= 0) {
      this.eventBus.emit({
        type: "budget:exhausted",
        timestamp: Date.now(),
        payload: { provider, cap: state.cap, consumed: state.consumed },
        traceId: "budget",
      });
    } else if (state.remaining <= state.softCap) {
      this.eventBus.emit({
        type: "budget:threshold",
        timestamp: Date.now(),
        payload: { provider, remaining: state.remaining, softCap: state.softCap },
        traceId: "budget",
      });
    }
  }

  destroy(): void {
    this.subscription?.unsubscribe();
  }
}
