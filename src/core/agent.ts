import type { AgentManifest, SubTask, TaskResult, ModelChoice, TokenUsage } from "./types.js";
import type { IAgent, ILLMCaller, LLMCallOptions } from "./interfaces.js";
import { PipelineStep } from "./pipeline-step.js";

export abstract class Agent
  extends PipelineStep<SubTask, TaskResult>
  implements IAgent
{
  abstract readonly manifest: AgentManifest;
  abstract readonly llmCaller: ILLMCaller;

  async execute(subTask: SubTask): Promise<TaskResult> {
    const model = subTask.assignedModel;
    if (!model) {
      return {
        subTaskId: subTask.id,
        output: null,
        success: false,
        error: "No model assigned to sub-task",
        actualTokens: { input: 0, output: 0, total: 0 },
        actualCost: 0,
        modelUsed: { provider: "openai", modelId: "unknown", estimatedTokens: { min: 0, max: 0, expected: 0 }, estimatedCost: 0 },
        latencyMs: 0,
        retries: 0,
      };
    }

    const span = this.startSpan("execute");
    const startedAt = Date.now();
    let retries = 0;

    const attempt = async (currentModel: ModelChoice): Promise<TaskResult> => {
      try {
        const prompt = this.buildPrompt(subTask);
        const options: LLMCallOptions = {
          model: currentModel.modelId,
          provider: currentModel.provider,
          systemPrompt: this.buildSystemPrompt(subTask),
          maxTokens: this.manifest.tokenProfile.max,
        };

        const result = await this.llmCaller.call(prompt, options);
        const output = this.parseOutput(result.content, subTask);

        const taskResult: TaskResult = {
          subTaskId: subTask.id,
          output,
          success: true,
          actualTokens: result.usage,
          actualCost: this.calculateCost(result.usage, currentModel),
          modelUsed: currentModel,
          latencyMs: Date.now() - startedAt,
          retries,
        };

        this.emit("subtask:completed", {
          subTaskId: subTask.id,
          agentId: this.manifest.id,
          model: currentModel.modelId,
          tokens: result.usage.total,
        });

        return taskResult;
      } catch (err) {
        retries++;
        this.emit("subtask:failed", {
          subTaskId: subTask.id,
          agentId: this.manifest.id,
          model: currentModel.modelId,
          error: err instanceof Error ? err.message : String(err),
          retry: retries,
        });

        if (retries <= this.manifest.maxRetries && currentModel.fallback) {
          this.emit("model:fallback", {
            subTaskId: subTask.id,
            from: currentModel.modelId,
            to: currentModel.fallback.modelId,
          });
          return attempt(currentModel.fallback);
        }

        return {
          subTaskId: subTask.id,
          output: null,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          actualTokens: { input: 0, output: 0, total: 0 },
          actualCost: 0,
          modelUsed: currentModel,
          latencyMs: Date.now() - startedAt,
          retries,
        };
      }
    };

    const result = await attempt(model);
    this.endSpan(span!, { success: result.success, retries: result.retries });
    return result;
  }

  protected abstract buildPrompt(subTask: SubTask): string;
  protected abstract buildSystemPrompt(subTask: SubTask): string;
  protected abstract parseOutput(raw: string, subTask: SubTask): unknown;

  protected calculateCost(usage: TokenUsage, model: ModelChoice): number {
    return model.estimatedCost;
  }
}
