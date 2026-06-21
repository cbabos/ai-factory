import type { FactoryEvent, EventType } from "./types.js";
import type { IEventBus, Subscription } from "./interfaces.js";
import { ConsoleLogger, type ILogger } from "./logger.js";

type EventHandler = (event: FactoryEvent) => void | Promise<void>;

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  constructor(private logger: ILogger = new ConsoleLogger({ namespace: "EventBus" })) {}

  emit(event: FactoryEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      void Promise.resolve(handler(event)).catch((err) => {
        this.logger.error(`handler error for ${event.type}:`, err);
      });
    }
  }

  on(type: EventType | string, handler: EventHandler): Subscription {
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    handlers.add(handler);
    return {
      unsubscribe: () => {
        handlers?.delete(handler);
      },
    };
  }

  off(type: EventType | string, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  listenerCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
