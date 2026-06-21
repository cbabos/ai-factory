import { WebClient } from "@slack/web-api";
import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

type SlackClient = {
  chat: {
    postMessage: (args: {
      channel: string;
      thread_ts?: string;
      text: string;
    }) => Promise<unknown>;
  };
};

export class SlackResponder implements IResponder {
  readonly channel = "slack";
  private client: SlackClient;

  constructor(client?: SlackClient) {
    this.client = client ?? new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const message = this.formatResult(result);
    try {
      await this.client.chat.postMessage({
        channel: task.origin.replyTo,
        thread_ts: task.origin.messageId || undefined,
        text: message,
      });
      return {
        taskId: task.id,
        channel: "slack",
        deliveredAt: Date.now(),
        success: true,
      };
    } catch (err) {
      return {
        taskId: task.id,
        channel: "slack",
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
    return `Completed in ${result.totalLatencyMs}ms | Tokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)}`;
  }
}
