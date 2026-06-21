import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { FinalResult, Task, DeliveryReceipt } from "../core/types.js";
import type { IResponder } from "../core/interfaces.js";

export class FileSystemResponder implements IResponder {
  readonly channel = "filesystem";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const dest = task.origin.replyTo || `./out/${task.id}.json`;
    try {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(
        dest,
        JSON.stringify({ taskId: task.id, result }, null, 2),
        "utf8",
      );
      return {
        taskId: task.id,
        channel: "filesystem",
        deliveredAt: Date.now(),
        success: true,
      };
    } catch (err) {
      return {
        taskId: task.id,
        channel: "filesystem",
        deliveredAt: Date.now(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
