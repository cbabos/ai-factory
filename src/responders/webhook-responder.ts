import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class WebhookResponder implements IResponder {
  readonly channel = "webhook";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const url = task.origin.replyTo;
    if (!url) {
      const message = "No callbackUrl provided; webhook result cannot be delivered";
      console.warn(`[WebhookResponder] ${message} for task ${task.id}`);
      return {
        taskId: task.id,
        channel: "webhook",
        deliveredAt: Date.now(),
        success: false,
        error: message,
      };
    }
    console.log(`[WebhookResponder] POSTing result for task ${task.id} to ${url}`);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      return {
        taskId: task.id,
        channel: "webhook",
        deliveredAt: Date.now(),
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        taskId: task.id,
        channel: "webhook",
        deliveredAt: Date.now(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
