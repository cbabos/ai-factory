import type { AgentManifest, SubTask, TaskResult, ModelChoice, TokenUsage } from "./types.js";
import type { IAgent, ILLMCaller, LLMCallOptions } from "./interfaces.js";
import type { IToolRegistry, ToolCall, ToolResult } from "../tools/interfaces.js";
import { PipelineStep } from "./pipeline-step.js";

const MAX_TOOL_ITERATIONS = 5;

function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /\u003ctool\s+name="([^"]+)"\s*\u003e([\s\S]*?)\u003c\/tool\u003e/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1] ?? "unknown";
    const argsText = (match[2] ?? "").trim();
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsText) as Record<string, unknown>;
    } catch {
      args = { raw: argsText };
    }
    calls.push({ id: `tc-${index++}`, name, arguments: args });
  }
  return calls;
}

function formatToolResults(results: ToolResult[]): string {
  return results
    .map((result) => {
      const errorPart = result.error ? `Error: ${result.error}\n` : "";
      return `\u003ctool_result name="${result.name}" success="${result.success}"\u003e\n${JSON.stringify(result.output)}\n${errorPart}\u003c/tool_result\u003e`;
    })
    .join("\n");
}

function buildToolsSystemPrompt(tools?: IToolRegistry): string {
  if (!tools || tools.list().length === 0) return "";
  const defs = tools
    .list()
    .map((tool) => {
      const params = tool.parameters
        .map((p) => `- ${p.name}${p.required ? "" : "?"}: ${p.type} — ${p.description}`)
        .join("\n");
      const exampleArgs: Record<string, string> = {};
      for (const p of tool.parameters) {
        exampleArgs[p.name] = `<${p.type}>`;
      }
      return `### ${tool.name}\n${tool.description}\nParameters:\n${params || "(none)"}\n\nUse it like:\n<tool name="${tool.name}"\u003e\n${JSON.stringify(exampleArgs, null, 2)}\n</tool\u003e`;
    })
    .join("\n\n");
  return `\n\nYou have access to the following tools:\n\n${defs}\n\nWhen you need to use a tool, output exactly one or more <tool name="..."\u003e...JSON arguments...</tool\u003e blocks. You will then receive the results and can continue.`;
}

export abstract class Agent
  extends PipelineStep<SubTask, TaskResult>
  implements IAgent
{
  abstract readonly manifest: AgentManifest;
  abstract readonly llmCaller: ILLMCaller;
  protected tools?: IToolRegistry;

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
    let totalInput = 0;
    let totalOutput = 0;

    const attempt = async (currentModel: ModelChoice): Promise<TaskResult> => {
      try {
        const basePrompt = this.buildPrompt(subTask);
        const baseSystemPrompt = this.buildSystemPrompt(subTask);
        const toolsPrompt = buildToolsSystemPrompt(this.tools);
        const systemPrompt = toolsPrompt
          ? `${baseSystemPrompt}${toolsPrompt}\n\nWhen you have enough information to answer, provide a final answer with no tool blocks.`
          : baseSystemPrompt;

        let prompt = basePrompt;
        let iteration = 0;
        let lastContent = "";

        while (iteration < MAX_TOOL_ITERATIONS) {
          const options: LLMCallOptions = {
            model: currentModel.modelId,
            provider: currentModel.provider,
            systemPrompt,
            maxTokens: this.manifest.tokenProfile.max,
          };

          const result = await this.llmCaller.call(prompt, options);
          totalInput += result.usage.input;
          totalOutput += result.usage.output;
          lastContent = result.content;

          const toolCalls = parseToolCalls(lastContent);
          if (toolCalls.length === 0 || !this.tools) {
            break;
          }

          const toolResults = await Promise.all(toolCalls.map((call) => this.tools!.execute(call)));
          prompt = `${basePrompt}\n\nYour previous response:\n${lastContent}\n\n${formatToolResults(toolResults)}\n\nContinue or provide a final answer.`;
          iteration++;
        }

        const output = this.parseOutput(lastContent, subTask);

        const taskResult: TaskResult = {
          subTaskId: subTask.id,
          output,
          success: true,
          actualTokens: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
          actualCost: this.calculateCost({ input: totalInput, output: totalOutput, total: totalInput + totalOutput }, currentModel),
          modelUsed: currentModel,
          latencyMs: Date.now() - startedAt,
          retries,
        };

        this.emit("subtask:completed", {
          subTaskId: subTask.id,
          agentId: this.manifest.id,
          model: currentModel.modelId,
          tokens: totalInput + totalOutput,
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
          totalInput = 0;
          totalOutput = 0;
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
