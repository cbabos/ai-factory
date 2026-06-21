import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

export class SlackAdapter implements ISignalAdapter {
  readonly channel = "slack";

  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as {
      text: string;
      channel: string;
      user: string;
      ts: string;
    };
    return {
      channel: "slack",
      content: payload.text,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: payload.channel,
        messageId: payload.ts,
        user: payload.user,
        rawPayload: raw.payload,
      },
    };
  }
}
