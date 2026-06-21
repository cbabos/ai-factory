import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

export class FileSystemAdapter implements ISignalAdapter {
  readonly channel = "filesystem";

  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { filePath: string; event: string };
    return {
      channel: "filesystem",
      content: `File event: ${payload.event} on ${payload.filePath}`,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: "",
        messageId: `fs_${raw.receivedAt}_${payload.filePath}`,
        filePath: payload.filePath,
        event: payload.event,
        rawPayload: raw.payload,
      },
    };
  }
}
