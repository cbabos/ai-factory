import type { TaskTrace, TraceSpan } from "./types.js";
import type { ITracer } from "./interfaces.js";

let nextSpanId = 0;

export class Tracer implements ITracer {
  private traces = new Map<string, TaskTrace>();

  startTrace(taskId: string): TaskTrace {
    const trace: TaskTrace = {
      traceId: crypto.randomUUID(),
      taskId,
      spans: [],
      startedAt: Date.now(),
    };
    this.traces.set(trace.traceId, trace);
    return trace;
  }

  startSpan(
    traceId: string,
    component: string,
    action: string,
    parentSpanId?: string,
  ): TraceSpan {
    const span: TraceSpan = {
      spanId: `span_${++nextSpanId}`,
      parentSpanId,
      component,
      action,
      startedAt: Date.now(),
      metadata: {},
    };
    this.traces.get(traceId)?.spans.push(span);
    return span;
  }

  endSpan(span: TraceSpan, metadata?: Record<string, unknown>): void {
    span.completedAt = Date.now();
    if (metadata) {
      Object.assign(span.metadata, metadata);
    }
  }

  endTrace(trace: TaskTrace): void {
    trace.completedAt = Date.now();
  }

  getTrace(traceId: string): TaskTrace | undefined {
    return this.traces.get(traceId);
  }
}
