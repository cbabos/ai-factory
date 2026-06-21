import { describe, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EmailResponder,
  SlackResponder,
  WebhookResponder,
  CronResponder,
  FileSystemResponder,
} from "../index.js";
import type { FinalResult, Task } from "../../core/types.js";

function makeTask(channel: Task["origin"]["channel"], replyTo?: string): Task {
  return {
    id: "t1",
    description: "task",
    context: {},
    origin: {
      channel,
      replyTo: replyTo ?? "user@example.com",
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
  it("sends email and returns a receipt", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    const responder = new EmailResponder({ sendMail } as unknown as import("nodemailer").Transporter);
    const receipt = await responder.respond(makeResult(true), makeTask("email"));

    expect(receipt.success).toBe(true);
    expect(receipt.channel).toBe("email");
    expect(receipt.taskId).toBe("t1");
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("formats failure results", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    const responder = new EmailResponder({ sendMail } as unknown as import("nodemailer").Transporter);
    await responder.respond(makeResult(false), makeTask("email"));

    const call = sendMail.mock.calls[0]?.[0] as { text: string };
    expect(call.text).toContain("Task failed");
  });
});

describe("SlackResponder", () => {
  it("posts message and returns a receipt", async () => {
    const postMessage = vi.fn().mockResolvedValue({ ok: true });
    const responder = new SlackResponder({ chat: { postMessage } });
    const receipt = await responder.respond(makeResult(true), makeTask("slack"));

    expect(receipt.channel).toBe("slack");
    expect(receipt.success).toBe(true);
    expect(postMessage).toHaveBeenCalledOnce();
  });

  it("formats success results with metrics", async () => {
    const postMessage = vi.fn().mockResolvedValue({ ok: true });
    const responder = new SlackResponder({ chat: { postMessage } });
    await responder.respond(makeResult(true), makeTask("slack"));

    const call = postMessage.mock.calls[0]?.[0] as { text: string };
    expect(call.text).toContain("100ms");
    expect(call.text).toContain("$0.0010");
  });
});

describe("WebhookResponder", () => {
  it("POSTs JSON and returns a receipt", async () => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.writeHead(200);
        res.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const url = `http://127.0.0.1:${port}/callback`;

    const responder = new WebhookResponder();
    const receipt = await responder.respond(makeResult(true), makeTask("webhook", url));

    expect(receipt.channel).toBe("webhook");
    expect(receipt.success).toBe(true);

    server.close();
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
  it("writes result to disk and returns a receipt", async () => {
    const path = join(tmpdir(), `ai-factory-test-${Date.now()}.json`);
    const responder = new FileSystemResponder();
    const receipt = await responder.respond(makeResult(true), makeTask("filesystem", path));

    expect(receipt.channel).toBe("filesystem");
    expect(receipt.success).toBe(true);

    const content = await readFile(path, "utf8");
    expect(content).toContain("t1");
    await unlink(path);
  });
});
