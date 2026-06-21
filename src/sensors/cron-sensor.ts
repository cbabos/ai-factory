import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";

export class CronSensor implements ISensor {
  readonly channel: Channel = "cron";
  readonly signals = new Subject<RawSignal>();

  private intervalId?: ReturnType<typeof setInterval>;
  private scheduleMs: number;
  private description: string;

  constructor(scheduleMs: number, description: string) {
    this.scheduleMs = scheduleMs;
    this.description = description;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.signals.next({
        channel: "cron",
        payload: { description: this.description },
        receivedAt: Date.now(),
        metadata: { schedule: this.scheduleMs },
      });
    }, this.scheduleMs);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
