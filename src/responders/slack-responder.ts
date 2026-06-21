import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class SlackResponder implements IResponder {
  readonly channel = "slack";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const message = this.formatResult(result);
    console.log(
      `[SlackResponder] Would post to ${task.origin.replyTo}, thread: ${task.origin.messageId}:\n${message}`,
    );

    return {
      taskId: task.id,
      channel: "slack",
      deliveredAt: Date.now(),
      success: true,
    };
  }

  private formatResult(result: FinalResult): string {
    if (!result.success) {
      return `Task failed: ${JSON.stringify(result.output)}`;
    }
    return `Completed in ${result.totalLatencyMs}ms | Tokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)}`;
  }
}
