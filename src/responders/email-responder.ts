import nodemailer from "nodemailer";
import type { Transporter, SentMessageInfo } from "nodemailer";
import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class EmailResponder implements IResponder {
  readonly channel = "email";
  private transporter: Transporter<SentMessageInfo>;

  constructor(transporter?: Transporter<SentMessageInfo>) {
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? "587"),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
  }

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const body = this.formatResult(result);
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: task.origin.replyTo,
        subject: `Task ${task.id} result`,
        text: body,
      });
      return {
        taskId: task.id,
        channel: "email",
        deliveredAt: Date.now(),
        success: true,
      };
    } catch (err) {
      return {
        taskId: task.id,
        channel: "email",
        deliveredAt: Date.now(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private formatResult(result: FinalResult): string {
    if (!result.success) {
      return `Task failed: ${JSON.stringify(result.output)}`;
    }
    return `Result:\n${JSON.stringify(result.output, null, 2)}\n\nTokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)} | Latency: ${result.totalLatencyMs}ms`;
  }
}
