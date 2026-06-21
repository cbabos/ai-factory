import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

export class EmailAdapter implements ISignalAdapter {
  readonly channel = "email";

  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as {
      subject: string;
      body: string;
      from: string;
      messageId: string;
    };
    return {
      channel: "email",
      content: `Subject: ${payload.subject}\n\n${payload.body}`,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: payload.from,
        messageId: payload.messageId,
        subject: payload.subject,
        rawPayload: raw.payload,
      },
    };
  }
}
