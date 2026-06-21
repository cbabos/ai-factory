import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

export class WebhookAdapter implements ISignalAdapter {
  readonly channel = "webhook";

  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as {
      body: unknown;
      headers: Record<string, string>;
    };
    const content =
      typeof payload.body === "string"
        ? payload.body
        : JSON.stringify(payload.body);
    return {
      channel: "webhook",
      content,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: (raw.metadata?.callbackUrl as string) ?? "",
        messageId: (raw.metadata?.requestId as string) ?? "",
        headers: payload.headers,
        rawPayload: raw.payload,
      },
    };
  }
}
