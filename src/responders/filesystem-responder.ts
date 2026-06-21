import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class FileSystemResponder implements IResponder {
  readonly channel = "filesystem";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    console.log(
      `[FileSystemResponder] File task ${task.id} completed:`,
      JSON.stringify(result.output),
    );

    return {
      taskId: task.id,
      channel: "filesystem",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
