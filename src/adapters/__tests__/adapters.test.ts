import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EmailAdapter,
  SlackAdapter,
  WebhookAdapter,
  CronAdapter,
  FileSystemAdapter,
} from "../index.js";
import type { RawSignal } from "../../core/types.js";

function makeRaw(channel: RawSignal["channel"], payload: unknown, metadata: Record<string, unknown> = {}): RawSignal {
  return {
    channel,
    payload,
    receivedAt: 1234567890,
    metadata,
  };
}

describe("EmailAdapter", () => {
  it("adapts an email raw signal", () => {
    const adapter = new EmailAdapter();
    const raw = makeRaw("email", {
      subject: "Hello",
      body: "World",
      from: "user@example.com",
      messageId: "m1",
    });
    const signal = adapter.adapt(raw);
    expect(signal.channel).toBe("email");
    expect(signal.content).toContain("Hello");
    expect(signal.content).toContain("World");
    expect(signal.metadata.replyTo).toBe("user@example.com");
    expect(signal.metadata.messageId).toBe("m1");
  });
});

describe("SlackAdapter", () => {
  it("adapts a slack raw signal", () => {
    const adapter = new SlackAdapter();
    const raw = makeRaw("slack", {
      text: "hello team",
      channel: "#general",
      user: "U123",
      ts: "123.456",
    });
    const signal = adapter.adapt(raw);
    expect(signal.channel).toBe("slack");
    expect(signal.content).toBe("hello team");
    expect(signal.metadata.replyTo).toBe("#general");
    expect(signal.metadata.messageId).toBe("123.456");
  });
});

describe("WebhookAdapter", () => {
  it("adapts a webhook with string body", () => {
    const adapter = new WebhookAdapter();
    const raw = makeRaw("webhook", { body: "plain text", headers: { "content-type": "text/plain" } }, {
      callbackUrl: "https://example.com/callback",
      requestId: "r1",
    });
    const signal = adapter.adapt(raw);
    expect(signal.content).toBe("plain text");
    expect(signal.metadata.replyTo).toBe("https://example.com/callback");
    expect(signal.metadata.messageId).toBe("r1");
  });

  it("stringifies object body", () => {
    const adapter = new WebhookAdapter();
    const raw = makeRaw("webhook", { body: { action: "deploy" }, headers: {} });
    const signal = adapter.adapt(raw);
    expect(signal.content).toBe(JSON.stringify({ action: "deploy" }));
  });
});

describe("CronAdapter", () => {
  it("adapts a cron raw signal", () => {
    const adapter = new CronAdapter();
    const raw = makeRaw("cron", { description: "hourly cleanup" }, { schedule: "0 * * * *" });
    const signal = adapter.adapt(raw);
    expect(signal.channel).toBe("cron");
    expect(signal.content).toBe("hourly cleanup");
    expect(signal.metadata.schedule).toBe("0 * * * *");
  });

  it("uses default content when no description", () => {
    const adapter = new CronAdapter();
    const raw = makeRaw("cron", {});
    const signal = adapter.adapt(raw);
    expect(signal.content).toBe("Scheduled task triggered");
  });
});

describe("FileSystemAdapter", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fs-adapter-"));
    filePath = join(tmpDir, "test.txt");
    writeFileSync(filePath, "hello from file", "utf-8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adapts a filesystem event and reads file contents", () => {
    const adapter = new FileSystemAdapter();
    const raw = makeRaw("filesystem", { filePath, event: "changed" });
    const signal = adapter.adapt(raw);
    expect(signal.channel).toBe("filesystem");
    expect(signal.content).toContain(filePath);
    expect(signal.content).toContain("changed");
    expect(signal.content).toContain("hello from file");
    expect(signal.metadata.filePath).toBe(filePath);
    expect(signal.metadata.fileContent).toBe("hello from file");
    expect(signal.metadata.truncated).toBe(false);
  });

  it("tags write-to-file directives with file-io and write capabilities", () => {
    const adapter = new FileSystemAdapter();
    writeFileSync(filePath, "Write the system date to /Users/cbabos/work/ai-factory/date.md in markdown format.", "utf-8");
    const raw = makeRaw("filesystem", { filePath, event: "changed" });
    const signal = adapter.adapt(raw);
    expect(signal.metadata.requiredCapabilities).toEqual(["file-io", "write"]);
    expect(signal.metadata.outputPath).toBe("/Users/cbabos/work/ai-factory/date.md");
  });

  it("does not tag read-only file content as a write task", () => {
    const adapter = new FileSystemAdapter();
    writeFileSync(filePath, "Please summarize the contents of this file.", "utf-8");
    const raw = makeRaw("filesystem", { filePath, event: "changed" });
    const signal = adapter.adapt(raw);
    expect(signal.metadata.requiredCapabilities).toBeUndefined();
    expect(signal.metadata.outputPath).toBeUndefined();
  });
});
