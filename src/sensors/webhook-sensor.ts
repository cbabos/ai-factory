import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";

export class WebhookSensor implements ISensor {
  readonly channel: Channel = "webhook";
  readonly signals = new Subject<RawSignal>();

  // Minimal stub: in production this would be an express/fastify server
  private port: number;
  private path: string;

  constructor(port: number, path: string = "/webhook") {
    this.port = port;
    this.path = path;
  }

  start(): void {
    console.log(
      `[WebhookSensor] Would start HTTP server on port ${this.port} at ${this.path}`,
    );
  }

  stop(): void {
    console.log("[WebhookSensor] Stopped");
  }

  // Exposed for manual injection in tests/stubs
  inject(payload: unknown, metadata?: Record<string, unknown>): void {
    this.signals.next({
      channel: "webhook",
      payload,
      receivedAt: Date.now(),
      metadata,
    });
  }
}
