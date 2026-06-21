import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  it("allows requests within burst size", () => {
    const limiter = new RateLimiter({ maxPerSecond: 1, burstSize: 3 });
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("a")).toBe(false);
  });

  it("refills tokens over time", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ maxPerSecond: 10, burstSize: 1 });
    expect(limiter.acquire("x")).toBe(true);
    expect(limiter.acquire("x")).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    expect(limiter.acquire("x")).toBe(true);

    vi.useRealTimers();
  });

  it("isolates keys", () => {
    const limiter = new RateLimiter({ maxPerSecond: 1, burstSize: 1 });
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("b")).toBe(true);
  });

  it("wait blocks until token available", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ maxPerSecond: 10, burstSize: 1 });
    expect(limiter.acquire("k")).toBe(true);

    const start = Date.now();
    const waitPromise = limiter.wait("k");
    await vi.advanceTimersByTimeAsync(150);
    await waitPromise;
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);

    vi.useRealTimers();
  });
});
