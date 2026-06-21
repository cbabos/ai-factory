import type { Task, TaskResult, FinalResult, TokenUsage } from "./types.js";
import type { IAggregator } from "./interfaces.js";

export class Aggregator implements IAggregator {
  aggregate(task: Task, results: TaskResult[]): FinalResult {
    const allSucceeded = results.every((r) => r.success);

    const totalTokens: TokenUsage = results.reduce(
      (acc, r) => ({
        input: acc.input + r.actualTokens.input,
        output: acc.output + r.actualTokens.output,
        total: acc.total + r.actualTokens.total,
      }),
      { input: 0, output: 0, total: 0 },
    );

    const totalCost = results.reduce((acc, r) => acc + r.actualCost, 0);
    const totalLatencyMs = results.reduce((acc, r) => acc + r.latencyMs, 0);

    const modelBreakdown: Record<string, TokenUsage> = {};
    for (const r of results) {
      const key = `${r.modelUsed.provider}:${r.modelUsed.modelId}`;
      const entry = modelBreakdown[key];
      if (entry) {
        entry.input += r.actualTokens.input;
        entry.output += r.actualTokens.output;
        entry.total += r.actualTokens.total;
      } else {
        modelBreakdown[key] = {
          input: r.actualTokens.input,
          output: r.actualTokens.output,
          total: r.actualTokens.total,
        };
      }
    }

    return {
      taskId: task.id,
      output: allSucceeded
        ? results.map((r) => r.output)
        : { error: "Some sub-tasks failed", subResults: results },
      success: allSucceeded,
      subResults: results,
      totalTokens,
      totalCost,
      totalLatencyMs,
      modelBreakdown,
    };
  }
}
