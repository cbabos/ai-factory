import { readFileSync, statSync } from "node:fs";
import type { RawSignal, Signal } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

const MAX_FILE_BYTES = 64 * 1024; // 64 KiB

export class FileSystemAdapter implements ISignalAdapter {
  readonly channel = "filesystem";

  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { filePath: string; event: string };
    const filePath = payload.filePath;
    let fileContent: string | undefined;
    let truncated = false;

    try {
      const stats = statSync(filePath);
      if (stats.isFile() && stats.size <= MAX_FILE_BYTES) {
        fileContent = readFileSync(filePath, "utf-8");
      } else if (stats.isFile()) {
        fileContent = readFileSync(filePath, "utf-8").slice(0, MAX_FILE_BYTES);
        truncated = true;
      }
    } catch {
      fileContent = undefined;
    }

    const content = fileContent !== undefined
      ? `File ${payload.event} event on ${filePath}${truncated ? " (truncated to 64KiB)" : ""}:\n\n${fileContent}`
      : `File ${payload.event} event on ${filePath} (content unavailable)`;

    return {
      channel: "filesystem",
      content,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: "",
        messageId: `fs_${raw.receivedAt}_${filePath}`,
        filePath,
        event: payload.event,
        fileContent,
        truncated,
        rawPayload: raw.payload,
      },
    };
  }
}
