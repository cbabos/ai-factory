import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class WebhookResponder implements IResponder {
  readonly channel = "webhook";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    console.log(
      `[WebhookResponder] Would POST to ${task.origin.replyTo}:`,
      JSON.stringify(result),
    );

    return {
      taskId: task.id,
      channel: "webhook",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
