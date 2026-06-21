import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

export class CronAdapter implements ISignalAdapter {
  readonly channel = "cron";

  adapt(raw: RawSignal): Signal {
    return {
      channel: "cron",
      content:
        (raw.payload as { description?: string })?.description ??
        "Scheduled task triggered",
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: "",
        messageId: `cron_${raw.receivedAt}`,
        schedule: raw.metadata?.schedule,
        rawPayload: raw.payload,
      },
    };
  }
}
