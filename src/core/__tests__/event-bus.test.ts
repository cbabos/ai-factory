import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../event-bus.js";
import { NoopLogger } from "../logger.js";
import type { FactoryEvent } from "../types.js";

function makeEvent(type: string, payload: Record<string, unknown>): FactoryEvent {
  return {
    type: type as FactoryEvent["type"],
    timestamp: Date.now(),
    payload,
    traceId: "test",
  };
}

describe("EventBus", () => {
  it("emits to a single handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("task:created", handler);
    bus.emit(makeEvent("task:created", { id: "1" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not emit to unrelated handlers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("task:created", handler);
    bus.emit(makeEvent("task:completed", { id: "1" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple handlers for same event type", () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("task:created", a);
    bus.on("task:created", b);
    bus.emit(makeEvent("task:created", { id: "1" }));
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("unsubscribes via subscription", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const sub = bus.on("task:created", handler);
    sub.unsubscribe();
    bus.emit(makeEvent("task:created", { id: "1" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes via off", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("task:created", handler);
    bus.off("task:created", handler);
    bus.emit(makeEvent("task:created", { id: "1" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports listener count", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    expect(bus.listenerCount("task:created")).toBe(0);
    bus.on("task:created", handler);
    expect(bus.listenerCount("task:created")).toBe(1);
  });

  it("handles async handler errors without throwing", async () => {
    const bus = new EventBus(new NoopLogger());
    const error = vi.fn().mockRejectedValue(new Error("async boom"));
    const success = vi.fn();
    bus.on("task:created", error);
    bus.on("task:created", success);
    expect(() => bus.emit(makeEvent("task:created", { id: "1" }))).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(success).toHaveBeenCalledOnce();
  });
});
