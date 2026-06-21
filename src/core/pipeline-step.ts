import type { IPipelineStep } from "./interfaces.js";
import type { FactoryEvent, TraceSpan } from "./types.js";
import type { IEventBus } from "./interfaces.js";
import type { ITracer } from "./interfaces.js";

export interface PipelineContext {
  eventBus: IEventBus;
  tracer: ITracer;
  traceId: string;
}

export abstract class PipelineStep<TInput, TOutput> implements IPipelineStep<TInput, TOutput> {
  abstract readonly name: string;

  protected ctx?: PipelineContext;

  setContext(ctx: PipelineContext): void {
    this.ctx = ctx;
  }

  abstract execute(input: TInput): Promise<TOutput>;

  validate?(_input: TInput): string[];

  protected emit(type: FactoryEvent["type"], payload: Record<string, unknown>): void {
    if (!this.ctx) return;
    this.ctx.eventBus.emit({
      type,
      timestamp: Date.now(),
      payload,
      traceId: this.ctx.traceId,
    });
  }

  protected startSpan(action: string, parentSpanId?: string): TraceSpan | undefined {
    if (!this.ctx) return undefined;
    return this.ctx.tracer.startSpan(this.ctx.traceId, this.name, action, parentSpanId);
  }

  protected endSpan(span: TraceSpan, metadata?: Record<string, unknown>): void {
    if (!this.ctx) return;
    this.ctx.tracer.endSpan(span, metadata);
  }
}
