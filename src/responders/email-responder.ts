import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class EmailResponder implements IResponder {
  readonly channel = "email";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const body = this.formatResult(result);
    console.log(
      `[EmailResponder] Would send to ${task.origin.replyTo}:\n${body}`,
    );

    return {
      taskId: task.id,
      channel: "email",
      deliveredAt: Date.now(),
      success: true,
    };
  }

  private formatResult(result: FinalResult): string {
    if (!result.success) {
      return `Task failed: ${JSON.stringify(result.output)}`;
    }
    return `Result:\n${JSON.stringify(result.output, null, 2)}\n\nTokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)} | Latency: ${result.totalLatencyMs}ms`;
  }
}
