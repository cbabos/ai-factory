import { describe, it, expect, vi } from "vitest";
import { BudgetTracker } from "../budget-tracker.js";
import { EventBus } from "../event-bus.js";
import type { TokenUsage, FactoryEvent } from "../types.js";

describe("BudgetTracker", () => {
  it("validates config on load", () => {
    const tracker = new BudgetTracker(new EventBus());
    expect(() => tracker.loadConfig({ defaultCap: 0, softCapRatio: 0.8 })).toThrow();
    expect(() => tracker.loadConfig({ defaultCap: 10, softCapRatio: 1.5 })).toThrow();
    expect(() => tracker.loadConfig({ defaultCap: 10, softCapRatio: 0.8 })).not.toThrow();
  });

  it("initializes state for providers", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai", "anthropic"]);
    const openai = tracker.getState("openai");
    expect(openai.cap).toBe(100);
    expect(openai.allocated).toBe(100);
    expect(openai.consumed).toBe(0);
    expect(openai.remaining).toBe(100);
    expect(openai.softCap).toBe(80);
  });

  it("throws for unknown provider state", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    expect(() => tracker.getState("unknown")).toThrow();
  });

  it("records usage and updates remaining", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    const usage: TokenUsage = { input: 100, output: 100, total: 200 };
    tracker.recordUsage("openai", usage, 5);
    const state = tracker.getState("openai");
    expect(state.consumed).toBe(5);
    expect(state.remaining).toBe(95);
  });

  it("returns copies of state", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    const state = tracker.getState("openai");
    state.consumed = 999;
    expect(tracker.getState("openai").consumed).toBe(0);
  });

  it("emits budget:threshold when remaining is at or below soft cap", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("budget:threshold", handler);
    const tracker = new BudgetTracker(bus);
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    tracker.recordUsage("openai", { input: 0, output: 0, total: 0 }, 20);
    expect(handler).toHaveBeenCalledOnce();
    tracker.recordUsage("openai", { input: 0, output: 0, total: 0 }, 60);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("emits budget:exhausted when remaining reaches zero", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("budget:exhausted", handler);
    const tracker = new BudgetTracker(bus);
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    tracker.recordUsage("openai", { input: 0, output: 0, total: 0 }, 100);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("reacts to token:consumed events", () => {
    const bus = new EventBus();
    const tracker = new BudgetTracker(bus);
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    bus.emit({
      type: "token:consumed",
      timestamp: Date.now(),
      payload: { provider: "openai", tokens: 100, cost: 10 },
      traceId: "x",
    });
    expect(tracker.getState("openai").consumed).toBe(10);
  });

  it("canAfford returns false for unknown provider", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    expect(tracker.canAfford("unknown", 0, 0)).toBe(false);
  });

  it("canAfford checks remaining cost", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    expect(tracker.canAfford("openai", 0, 50)).toBe(true);
    tracker.recordUsage("openai", { input: 0, output: 0, total: 0 }, 60);
    expect(tracker.canAfford("openai", 0, 50)).toBe(false);
  });

  it("reset restores budget", () => {
    const tracker = new BudgetTracker(new EventBus());
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    tracker.recordUsage("openai", { input: 0, output: 0, total: 0 }, 50);
    tracker.reset("openai");
    expect(tracker.getState("openai").consumed).toBe(0);
    expect(tracker.getState("openai").remaining).toBe(100);
  });

  it("destroy unsubscribes from event bus", () => {
    const bus = new EventBus();
    const tracker = new BudgetTracker(bus);
    tracker.loadConfig({ defaultCap: 100, softCapRatio: 0.8 });
    tracker.initialize(["openai"]);
    tracker.destroy();
    bus.emit({
      type: "token:consumed",
      timestamp: Date.now(),
      payload: { provider: "openai", tokens: 100, cost: 10 },
      traceId: "x",
    } as FactoryEvent);
    expect(tracker.getState("openai").consumed).toBe(0);
  });
});
