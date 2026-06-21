import { App } from "@slack/bolt";
import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";
import { NoopLogger, type ILogger } from "../core/logger.js";

export interface SlackSensorConfig {
  token: string;
  signingSecret: string;
  port?: number;
}

export class SlackSensor implements ISensor {
  readonly channel: Channel = "slack";
  readonly signals: Subject<RawSignal>;

  private app: App;
  private port: number;
  private running = false;

  constructor(config: SlackSensorConfig, logger?: ILogger) {
    this.signals = new Subject<RawSignal>(logger ?? new NoopLogger());
    this.port = config.port ?? 3000;
    this.app = new App({
      token: config.token,
      signingSecret: config.signingSecret,
    });

    this.app.message(async ({ message }) => {
      if (message.subtype) return;
      const text = "text" in message ? (message.text as string) : "";
      const channel = "channel" in message ? (message.channel as string) : "";
      const ts = "ts" in message ? (message.ts as string) : "";
      this.signals.next({
        channel: "slack",
        payload: { text, user: (message as unknown as Record<string, unknown>).user, channel },
        receivedAt: Date.now(),
        metadata: { channel, threadTs: ts },
      });
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.app.start(this.port).catch(() => {
      this.running = false;
    });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    void this.app.stop().catch(() => {});
  }

  // Exposed for manual injection in tests/stubs
  inject(payload: unknown, metadata?: Record<string, unknown>): void {
    this.signals.next({
      channel: "slack",
      payload,
      receivedAt: Date.now(),
      metadata,
    });
  }
}
