import { describe, it, expect } from "vitest";
import { MetricsCollector } from "../metrics-collector.js";
import { EventBus } from "../event-bus.js";
import { NoopLogger } from "../logger.js";
import type { FactoryEvent, EventType } from "../types.js";

function makeEvent(type: EventType, payload: Record<string, unknown> = {}): FactoryEvent {
  return {
    type,
    timestamp: Date.now(),
    payload,
    traceId: "t1",
  };
}

describe("MetricsCollector", () => {
  it("counts task and subtask lifecycle events", () => {
    const bus = new EventBus(new NoopLogger());
    const metrics = new MetricsCollector(bus);

    bus.emit(makeEvent("task:created"));
    bus.emit(makeEvent("task:completed", { totalTokens: { input: 10, output: 5, total: 15 }, totalCost: 0.001 }));
    bus.emit(makeEvent("task:failed"));
    bus.emit(makeEvent("subtask:started"));
    bus.emit(makeEvent("subtask:completed", { model: "openai:gpt-4o-mini" }));
    bus.emit(makeEvent("subtask:failed"));

    const snapshot = metrics.snapshot();
    expect(snapshot.tasksCreated).toBe(1);
    expect(snapshot.tasksCompleted).toBe(1);
    expect(snapshot.tasksFailed).toBe(1);
    expect(snapshot.subtasksStarted).toBe(1);
    expect(snapshot.subtasksCompleted).toBe(1);
    expect(snapshot.subtasksFailed).toBe(1);
    expect(snapshot.totalTokens).toEqual({ input: 10, output: 5, total: 15 });
    expect(snapshot.totalCost).toBe(0.001);
    expect(snapshot.modelUsage["openai:gpt-4o-mini"]).toBe(1);

    metrics.destroy();
  });

  it("counts budget threshold and exhaustion events", () => {
    const bus = new EventBus(new NoopLogger());
    const metrics = new MetricsCollector(bus);

    bus.emit(makeEvent("budget:threshold"));
    bus.emit(makeEvent("budget:exhausted"));
    bus.emit(makeEvent("budget:threshold"));

    const snapshot = metrics.snapshot();
    expect(snapshot.budgetThresholds).toBe(2);
    expect(snapshot.budgetExhaustions).toBe(1);

    metrics.destroy();
  });

  it("unsubscribes on destroy", () => {
    const bus = new EventBus(new NoopLogger());
    const metrics = new MetricsCollector(bus);
    metrics.destroy();

    bus.emit(makeEvent("task:created"));
    expect(metrics.snapshot().tasksCreated).toBe(0);
  });
});
