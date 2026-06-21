import { describe, it, expect } from "vitest";
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
  it("adapts a filesystem event", () => {
    const adapter = new FileSystemAdapter();
    const raw = makeRaw("filesystem", { filePath: "/tmp/foo.txt", event: "changed" });
    const signal = adapter.adapt(raw);
    expect(signal.channel).toBe("filesystem");
    expect(signal.content).toContain("/tmp/foo.txt");
    expect(signal.content).toContain("changed");
    expect(signal.metadata.filePath).toBe("/tmp/foo.txt");
  });
});
