import { describe, it, expect, vi } from "vitest";
import {
  EmailResponder,
  SlackResponder,
  WebhookResponder,
  CronResponder,
  FileSystemResponder,
} from "../index.js";
import type { FinalResult, Task } from "../../core/types.js";

function makeTask(channel: Task["origin"]["channel"]): Task {
  return {
    id: "t1",
    description: "task",
    context: {},
    origin: {
      channel,
      replyTo: "user@example.com",
      messageId: "m1",
      rawPayload: {},
    },
    priority: "normal",
    createdAt: Date.now(),
  };
}

function makeResult(success: boolean): FinalResult {
  return {
    taskId: "t1",
    output: success ? { result: "ok" } : { error: "failed" },
    success,
    subResults: [],
    totalTokens: { input: 10, output: 10, total: 20 },
    totalCost: 0.001,
    totalLatencyMs: 100,
    modelBreakdown: {},
  };
}

describe("EmailResponder", () => {
  it("logs and returns a receipt", async () => {
    const responder = new EmailResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const receipt = await responder.respond(makeResult(true), makeTask("email"));

    expect(receipt.success).toBe(true);
    expect(receipt.channel).toBe("email");
    expect(receipt.taskId).toBe("t1");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("formats failure results", async () => {
    const responder = new EmailResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await responder.respond(makeResult(false), makeTask("email"));

    const message = log.mock.calls[0]?.[0] as string;
    expect(message).toContain("Task failed");
    log.mockRestore();
  });
});

describe("SlackResponder", () => {
  it("logs and returns a receipt", async () => {
    const responder = new SlackResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const receipt = await responder.respond(makeResult(true), makeTask("slack"));

    expect(receipt.channel).toBe("slack");
    expect(receipt.success).toBe(true);
    log.mockRestore();
  });

  it("formats success results with metrics", async () => {
    const responder = new SlackResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await responder.respond(makeResult(true), makeTask("slack"));

    const message = log.mock.calls[0]?.[0] as string;
    expect(message).toContain("100ms");
    expect(message).toContain("$0.0010");
    log.mockRestore();
  });
});

describe("WebhookResponder", () => {
  it("logs and returns a receipt", async () => {
    const responder = new WebhookResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const receipt = await responder.respond(makeResult(true), makeTask("webhook"));

    expect(receipt.channel).toBe("webhook");
    expect(receipt.success).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("CronResponder", () => {
  it("logs and returns a receipt", async () => {
    const responder = new CronResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const receipt = await responder.respond(makeResult(true), makeTask("cron"));

    expect(receipt.channel).toBe("cron");
    expect(receipt.success).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("FileSystemResponder", () => {
  it("logs and returns a receipt", async () => {
    const responder = new FileSystemResponder();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const receipt = await responder.respond(makeResult(true), makeTask("filesystem"));

    expect(receipt.channel).toBe("filesystem");
    expect(receipt.success).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
