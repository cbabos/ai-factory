import type { IObservable, Subscription } from "./interfaces.js";
import { ConsoleLogger, type ILogger } from "./logger.js";

export class Subject<T> implements IObservable<T> {
  private handlers = new Set<(value: T) => void | Promise<void>>();

  constructor(private logger: ILogger = new ConsoleLogger({ namespace: "Subject" })) {}

  subscribe(handler: (value: T) => void | Promise<void>): Subscription {
    this.handlers.add(handler);
    return {
      unsubscribe: () => {
        this.handlers.delete(handler);
      },
    };
  }

  next(value: T): void {
    for (const handler of this.handlers) {
      try {
      void Promise.resolve(handler(value)).catch((err) => {
        this.logger.error("handler error:", err);
      });
    } catch (err) {
      this.logger.error("handler error:", err);
    }
    }
  }

  get subscriberCount(): number {
    return this.handlers.size;
  }
}
