import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker } from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("passes through successful calls", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 1000 });
    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.getState()).toBe("closed");
  });

  it("opens after threshold failures", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(breaker.execute(fn)).rejects.toThrow("boom");
    await expect(breaker.execute(fn)).rejects.toThrow("boom");

    expect(breaker.getState()).toBe("open");
    await expect(breaker.execute(fn)).rejects.toThrow("Circuit breaker is open");
  });

  it("transitions to half-open after open duration", async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 500 });

    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.getState()).toBe("open");

    await vi.advanceTimersByTimeAsync(500);
    expect(breaker.getState()).toBe("half-open");

    vi.useRealTimers();
  });

  it("closes after a successful half-open call", async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 500 });

    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(500);

    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.getState()).toBe("closed");

    vi.useRealTimers();
  });

  it("re-opens after a failed half-open call", async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 500 });

    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(500);

    await expect(breaker.execute(() => Promise.reject(new Error("fail2")))).rejects.toThrow("fail2");
    expect(breaker.getState()).toBe("open");

    vi.useRealTimers();
  });
});
