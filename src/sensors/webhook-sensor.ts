import type { Server } from "node:http";
import express from "express";
import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";
import { NoopLogger, type ILogger } from "../core/logger.js";

export class WebhookSensor implements ISensor {
  readonly channel: Channel = "webhook";
  readonly signals: Subject<RawSignal>;

  private app: express.Express;
  private server?: Server;

  constructor(
    private port: number,
    private path: string = "/webhook",
    logger?: ILogger,
  ) {
    this.signals = new Subject<RawSignal>(logger ?? new NoopLogger());
    this.app = express();
    this.app.use(express.json());
    this.app.post(this.path, (req, res) => {
      this.signals.next({
        channel: "webhook",
        payload: req.body,
        receivedAt: Date.now(),
        metadata: { headers: req.headers },
      });
      res.status(202).json({ received: true });
    });
  }

  start(): void {
    this.server = this.app.listen(this.port);
  }

  getPort(): number | undefined {
    const address = this.server?.address();
    if (typeof address === "object" && address) return address.port;
    return undefined;
  }

  stop(): void {
    this.server?.close();
    this.server = undefined;
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
