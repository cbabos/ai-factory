import type { SubTask, TaskResult } from "./types.js";
import type { IAgent, IAgentRegistry, IDispatcher } from "./interfaces.js";
import { PipelineStep } from "./pipeline-step.js";

export class Dispatcher
  extends PipelineStep<SubTask[], TaskResult[]>
  implements IDispatcher
{
  readonly name = "Dispatcher";

  private registry: IAgentRegistry;
  private agents: Map<string, IAgent>;
  private maxConcurrency: number;
  private onSubTaskCompleted?: (subTask: SubTask, result: TaskResult) => Promise<void>;

  constructor(
    registry: IAgentRegistry,
    agents: Map<string, IAgent>,
    maxConcurrency: number,
    onSubTaskCompleted?: (subTask: SubTask, result: TaskResult) => Promise<void>,
  ) {
    super();
    this.registry = registry;
    this.agents = agents;
    this.maxConcurrency = maxConcurrency;
    this.onSubTaskCompleted = onSubTaskCompleted;
  }

  async execute(subTasks: SubTask[]): Promise<TaskResult[]> {
    const span = this.startSpan("dispatch");
    const results = new Map<string, TaskResult>();
    const inFlight = new Map<string, Promise<void>>();
    const completed = new Set<string>();

    const getReady = (): SubTask[] =>
      subTasks.filter(
        (st) =>
          !completed.has(st.id) &&
          !inFlight.has(st.id) &&
          st.dependencies.every((depId) => completed.has(depId)),
      );

    const executeOne = async (subTask: SubTask): Promise<void> => {
      const agent = this.findAgent(subTask);
      if (!agent) {
        results.set(subTask.id, this.noAgentResult(subTask));
        return;
      }

      this.emit("subtask:started", {
        subTaskId: subTask.id,
        agentId: agent.manifest.id,
        model: subTask.assignedModel?.modelId,
      });

      const result = await agent.execute(subTask);
      results.set(subTask.id, result);
      await this.onSubTaskCompleted?.(subTask, result);
    };

    while (completed.size < subTasks.length) {
      const ready = getReady();

      if (ready.length === 0 && inFlight.size === 0) {
        for (const st of subTasks) {
          if (!completed.has(st.id)) {
            results.set(st.id, {
              subTaskId: st.id,
              output: null,
              success: false,
              error: `Unresolvable dependency cycle or missing dependency for ${st.id}`,
              actualTokens: { input: 0, output: 0, total: 0 },
              actualCost: 0,
              modelUsed: st.assignedModel ?? {
                provider: "openai",
                modelId: "unknown",
                estimatedTokens: { min: 0, max: 0, expected: 0 },
                estimatedCost: 0,
                costPer1kInput: 0,
                costPer1kOutput: 0,
              },
              latencyMs: 0,
              retries: 0,
            });
            completed.add(st.id);
          }
        }
        break;
      }

      const slots = this.maxConcurrency - inFlight.size;
      const toLaunch = ready.slice(0, Math.max(0, slots));

      for (const st of toLaunch) {
        const promise = executeOne(st).finally(() => {
          inFlight.delete(st.id);
          completed.add(st.id);
        });
        inFlight.set(st.id, promise);
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight.values());
      }
    }

    const ordered = subTasks.map((st) => results.get(st.id)!);
    this.endSpan(span!, { subTaskCount: subTasks.length });
    return ordered;
  }

  private findAgent(subTask: SubTask): IAgent | undefined {
    const rankedCandidates = this.registry.rankByTags(subTask.capabilityTags);

    for (const candidate of rankedCandidates) {
      const agent = this.agents.get(candidate.manifest.id);
      if (agent) return agent;
    }

    return undefined;
  }

  private noAgentResult(subTask: SubTask): TaskResult {
    const rankedCandidates = this.registry.rankByTags(subTask.capabilityTags).slice(0, 3);
    const rankedSummary = rankedCandidates.length > 0
      ? ` Top candidates: ${rankedCandidates.map((candidate) =>
        `${candidate.manifest.id} (score ${candidate.score}, missing ${candidate.missingTaskTags.length}, extra ${candidate.extraAgentTags.length})`).join("; ")}`
      : "";

    return {
      subTaskId: subTask.id,
      output: null,
      success: false,
      error: `No agent found for tags: ${subTask.capabilityTags.join(", ")}.${rankedSummary}`,
      actualTokens: { input: 0, output: 0, total: 0 },
      actualCost: 0,
      modelUsed: subTask.assignedModel ?? {
        provider: "openai",
        modelId: "unknown",
        estimatedTokens: { min: 0, max: 0, expected: 0 },
        estimatedCost: 0,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
      latencyMs: 0,
      retries: 0,
      conversation: [
        {
          role: "tool",
          content: JSON.stringify({
            requestedTags: subTask.capabilityTags,
            rankedCandidates: rankedCandidates.map((candidate) => ({
              agentId: candidate.manifest.id,
              score: candidate.score,
              matchedTaskTags: candidate.matchedTaskTags,
              missingTaskTags: candidate.missingTaskTags,
              extraAgentTags: candidate.extraAgentTags,
            })),
          }),
          timestamp: Date.now(),
          metadata: { phase: "dispatch-routing" },
        },
      ],
    };
  }
}
