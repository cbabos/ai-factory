import Imap from "imap";
import { simpleParser, type AddressObject } from "mailparser";
import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";
import { NoopLogger, type ILogger } from "../core/logger.js";

function addressText(addr: AddressObject | AddressObject[] | undefined): string | undefined {
  if (!addr) return undefined;
  if (Array.isArray(addr)) return addr.map((a) => a.text).join(", ");
  return addr.text;
}

export interface EmailSensorConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls?: boolean;
  mailbox?: string;
  pollIntervalMs?: number;
}

export class EmailSensor implements ISensor {
  readonly channel: Channel = "email";
  readonly signals: Subject<RawSignal>;

  private config: EmailSensorConfig;
  private timer?: ReturnType<typeof setInterval>;

  constructor(config: EmailSensorConfig, logger?: ILogger) {
    this.config = {
      mailbox: "INBOX",
      pollIntervalMs: 60_000,
      tls: true,
      ...config,
    };
    this.signals = new Subject<RawSignal>(logger ?? new NoopLogger());
  }

  start(): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.config.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  // Exposed for manual injection in tests/stubs
  inject(payload: unknown, metadata?: Record<string, unknown>): void {
    this.signals.next({
      channel: "email",
      payload,
      receivedAt: Date.now(),
      metadata,
    });
  }

  private async poll(): Promise<void> {
    return new Promise<void>((resolve) => {
      const imap = new Imap({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        tls: this.config.tls,
      });

      imap.once("ready", () => {
        imap.openBox(this.config.mailbox!, false, (err, _box) => {
          if (err) {
            imap.end();
            resolve();
            return;
          }

          imap.search(["UNSEEN"], (searchErr, results) => {
            if (searchErr || !results || results.length === 0) {
              imap.end();
              resolve();
              return;
            }

            const fetch = imap.fetch(results, { bodies: "", markSeen: true });
            fetch.on("message", (msg) => {
              let body = "";
              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  body += chunk.toString("utf8");
                });
              });
              msg.once("end", async () => {
                const parsed = await simpleParser(body);
                this.signals.next({
                  channel: "email",
                  payload: {
                    from: addressText(parsed.from),
                    subject: parsed.subject,
                    text: parsed.text,
                    html: parsed.html,
                  },
                  receivedAt: Date.now(),
                  metadata: {
                    messageId: parsed.messageId,
                    to: addressText(parsed.to),
                  },
                });
              });
            });
            fetch.once("end", () => {
              imap.end();
            });
          });
        });
      });

      imap.once("error", () => {
        resolve();
      });

      imap.once("end", () => {
        resolve();
      });

      imap.connect();
    });
  }
}
