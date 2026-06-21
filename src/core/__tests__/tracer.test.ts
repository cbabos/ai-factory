import { describe, it, expect } from "vitest";
import { Tracer } from "../tracer.js";

describe("Tracer", () => {
  it("starts and retrieves a trace", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("task-1");
    expect(trace.taskId).toBe("task-1");
    expect(trace.spans).toEqual([]);
    expect(trace.startedAt).toBeLessThanOrEqual(Date.now());

    const retrieved = tracer.getTrace(trace.traceId);
    expect(retrieved).toBe(trace);
  });

  it("creates unique trace ids", () => {
    const tracer = new Tracer();
    const a = tracer.startTrace("a");
    const b = tracer.startTrace("b");
    expect(a.traceId).not.toBe(b.traceId);
  });

  it("adds spans to a trace", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("task-1");
    const span = tracer.startSpan(trace.traceId, "estimator", "estimate");

    expect(span.component).toBe("estimator");
    expect(span.action).toBe("estimate");
    expect(span.parentSpanId).toBeUndefined();
    expect(span.metadata).toEqual({});

    const retrieved = tracer.getTrace(trace.traceId);
    expect(retrieved?.spans).toHaveLength(1);
  });

  it("supports parent spans", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("task-1");
    const parent = tracer.startSpan(trace.traceId, "orch", "run");
    const child = tracer.startSpan(trace.traceId, "estimator", "estimate", parent.spanId);

    expect(child.parentSpanId).toBe(parent.spanId);
  });

  it("ends a span with metadata", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("task-1");
    const span = tracer.startSpan(trace.traceId, "orch", "run");
    tracer.endSpan(span, { score: 5 });

    expect(span.completedAt).toBeDefined();
    expect(span.completedAt).toBeGreaterThanOrEqual(span.startedAt);
    expect(span.metadata).toEqual({ score: 5 });
  });

  it("ends a trace", () => {
    const tracer = new Tracer();
    const trace = tracer.startTrace("task-1");
    tracer.endTrace(trace);

    expect(trace.completedAt).toBeDefined();
    expect(trace.completedAt).toBeGreaterThanOrEqual(trace.startedAt);
  });

  it("returns undefined for unknown trace", () => {
    const tracer = new Tracer();
    expect(tracer.getTrace("missing")).toBeUndefined();
  });

  it("does not throw when adding a span to an unknown trace", () => {
    const tracer = new Tracer();
    expect(() =>
      tracer.startSpan("missing", "component", "action"),
    ).not.toThrow();
  });
});
