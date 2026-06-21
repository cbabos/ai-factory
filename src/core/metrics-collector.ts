import type { IEventBus, Subscription } from "./interfaces.js";
import type { FactoryEvent, MetricSnapshot, TokenUsage } from "./types.js";

export interface IMetricsCollector {
  snapshot(): MetricSnapshot;
  destroy(): void;
}

export class MetricsCollector implements IMetricsCollector {
  private tasksCreated = 0;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private subtasksStarted = 0;
  private subtasksCompleted = 0;
  private subtasksFailed = 0;
  private totalTokens: TokenUsage = { input: 0, output: 0, total: 0 };
  private totalCost = 0;
  private modelUsage: Record<string, number> = {};
  private budgetThresholds = 0;
  private budgetExhaustions = 0;

  private subscriptions: Subscription[] = [];

  constructor(private readonly eventBus: IEventBus) {
    this.subscriptions = [
      eventBus.on("task:created", () => { this.tasksCreated++; }),
      eventBus.on("task:completed", (event) => { this.onTaskCompleted(event); }),
      eventBus.on("task:failed", () => { this.tasksFailed++; }),
      eventBus.on("subtask:started", () => { this.subtasksStarted++; }),
      eventBus.on("subtask:completed", (event) => { this.onSubtaskCompleted(event); }),
      eventBus.on("subtask:failed", () => { this.subtasksFailed++; }),
      eventBus.on("budget:threshold", () => { this.budgetThresholds++; }),
      eventBus.on("budget:exhausted", () => { this.budgetExhaustions++; }),
    ];
  }

  snapshot(): MetricSnapshot {
    return {
      tasksCreated: this.tasksCreated,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      subtasksStarted: this.subtasksStarted,
      subtasksCompleted: this.subtasksCompleted,
      subtasksFailed: this.subtasksFailed,
      totalTokens: { ...this.totalTokens },
      totalCost: this.totalCost,
      modelUsage: { ...this.modelUsage },
      budgetThresholds: this.budgetThresholds,
      budgetExhaustions: this.budgetExhaustions,
    };
  }

  destroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
  }

  private onTaskCompleted(event: FactoryEvent): void {
    this.tasksCompleted++;
    const payload = event.payload;
    const totalTokens = payload.totalTokens as TokenUsage | undefined;
    if (totalTokens) {
      this.totalTokens.input += totalTokens.input;
      this.totalTokens.output += totalTokens.output;
      this.totalTokens.total += totalTokens.total;
    }
    const totalCost = payload.totalCost as number | undefined;
    if (typeof totalCost === "number") {
      this.totalCost += totalCost;
    }
  }

  private onSubtaskCompleted(event: FactoryEvent): void {
    this.subtasksCompleted++;
    const payload = event.payload;
    const model = payload.model as string | undefined;
    if (model) {
      this.modelUsage[model] = (this.modelUsage[model] ?? 0) + 1;
    }
  }
}
