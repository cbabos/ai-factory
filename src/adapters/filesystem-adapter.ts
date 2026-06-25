import { readFileSync, statSync } from "node:fs";
import type { RawSignal, Signal, CapabilityTag } from "../core/types.js";
import type { ISignalAdapter } from "../core/interfaces.js";

const MAX_FILE_BYTES = 64 * 1024; // 64 KiB

// Patterns that strongly suggest the user wants output written to a file.
const WRITE_DIRECTIVE_RE = /\b(?:write|save|output|export)\b.*?\b(?:to|into)\b\s+(?:the\s+)?(?:file\s+)?[`\"']?([\w\-/:. ]+\.[\w]+)[`\"']?/i;

function extractWritePath(text: string): string | undefined {
  const match = WRITE_DIRECTIVE_RE.exec(text);
  if (match?.[1]) return match[1].trim();
  return undefined;
}

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

    const metadata: Signal["metadata"] = {
      replyTo: "",
      messageId: `fs_${raw.receivedAt}_${filePath}`,
      filePath,
      event: payload.event,
      fileContent,
      truncated,
      rawPayload: raw.payload,
    };

    const writePath = extractWritePath(content);
    if (writePath) {
      metadata.requiredCapabilities = ["file-io", "write"] as CapabilityTag[];
      metadata.outputPath = writePath;
    }

    return {
      channel: "filesystem",
      content,
      receivedAt: raw.receivedAt,
      metadata,
    };
  }
}
