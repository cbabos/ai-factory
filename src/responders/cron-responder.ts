import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class CronResponder implements IResponder {
  readonly channel = "cron";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    console.log(
      `[CronResponder] Cron task ${task.id} completed:`,
      JSON.stringify(result.output),
    );

    return {
      taskId: task.id,
      channel: "cron",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
