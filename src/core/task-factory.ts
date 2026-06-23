import type { Signal, Task, Priority, CapabilityTag } from "./types.js";
import type { ITaskFactory } from "./interfaces.js";

export class TaskFactory implements ITaskFactory {
  create(signal: Signal): Task {
    const constraints = signal.metadata.requiredCapabilities
      ? { requiredCapabilities: signal.metadata.requiredCapabilities as CapabilityTag[] }
      : undefined;

    return {
      id: crypto.randomUUID(),
      description: signal.content,
      context: signal.metadata,
      origin: {
        channel: signal.channel,
        replyTo: (signal.metadata.replyTo as string) ?? "",
        messageId: (signal.metadata.messageId as string) ?? "",
        rawPayload: signal.metadata.rawPayload,
      },
      priority: this.derivePriority(signal),
      createdAt: Date.now(),
      constraints,
    };
  }

  private derivePriority(signal: Signal): Priority {
    const meta = signal.metadata;
    if (meta.urgent === true || meta.priority === "critical") return "critical";
    if (meta.priority === "high") return "high";
    if (meta.priority === "batch") return "batch";
    return "normal";
  }
}
