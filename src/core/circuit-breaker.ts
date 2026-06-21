export interface ICircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): "closed" | "open" | "half-open";
}

type BreakerState = "closed" | "open" | "half-open";

export class CircuitBreaker implements ICircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private state: BreakerState = "closed";
  private failures = 0;
  private nextAttemptAt = 0;

  constructor(options: { failureThreshold: number; openDurationMs: number }) {
    this.failureThreshold = options.failureThreshold;
    this.openDurationMs = options.openDurationMs;
  }

  getState(): BreakerState {
    if (this.state === "open" && Date.now() >= this.nextAttemptAt) {
      this.state = "half-open";
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === "open") {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.nextAttemptAt = Date.now() + this.openDurationMs;
    }
  }
}
