import type { AgentManifest, SubTask, TaskResult, ModelChoice, TokenUsage } from "./types.js";
import type { IAgent, ILLMCaller, LLMCallOptions } from "./interfaces.js";
import type { IToolRegistry, ToolCall, ToolResult } from "../tools/interfaces.js";
import { PipelineStep } from "./pipeline-step.js";

const MAX_TOOL_ITERATIONS = 5;

function tryJsonParse(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function parseXmlToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /\u003ctool\s+name="([^"]+)"\s*\u003e([\s\S]*?)\u003c\/tool\u003e/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1] ?? "unknown";
    const argsText = (match[2] ?? "").trim();
    const args = tryJsonParse(argsText) ?? { raw: argsText };
    calls.push({ id: `xml-${index++}`, name, arguments: args });
  }
  return calls;
}

function parseFunctionCallToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /\u003cfunction_calls\u003e([\s\S]*?)\u003c\/function_calls\u003e|\u003cfunctions\u003e([\s\S]*?)\u003c\/functions\u003e/g;
  let wrapperMatch: RegExpExecArray | null;
  let index = 0;
  while ((wrapperMatch = regex.exec(content)) !== null) {
    const inner = (wrapperMatch[1] ?? wrapperMatch[2] ?? "").trim();
    const invokeRegex = /\u003cinvoke name="([^"]+)"\u003e([\s\S]*?)\u003c\/invoke\u003e|\u003cfunction name="([^"]+)"\u003e([\s\S]*?)\u003c\/function\u003e/g;
    let invokeMatch: RegExpExecArray | null;
    while ((invokeMatch = invokeRegex.exec(inner)) !== null) {
      const name = (invokeMatch[1] ?? invokeMatch[3]) || "unknown";
      const argsText = (invokeMatch[2] ?? invokeMatch[4] ?? "").trim();
      const args = tryJsonParse(argsText) ?? { raw: argsText };
      calls.push({ id: `fn-${index++}`, name, arguments: args });
    }

    // Also support bare <function=...>{...}</function> outside wrappers
    const bareRegex = /\u003cfunction=([^\u003e]+)\u003e([\s\S]*?)\u003c\/function\u003e/g;
    let bareMatch: RegExpExecArray | null;
    while ((bareMatch = bareRegex.exec(inner)) !== null) {
      const name = bareMatch[1] || "unknown";
      const argsText = (bareMatch[2] ?? "").trim();
      const args = tryJsonParse(argsText) ?? { raw: argsText };
      calls.push({ id: `fn-${index++}`, name, arguments: args });
    }
  }

  // Support top-level bare function tags too
  const topLevelRegex = /\u003cfunction=([^\u003e]+)\u003e([\s\S]*?)\u003c\/function\u003e/g;
  let topMatch: RegExpExecArray | null;
  while ((topMatch = topLevelRegex.exec(content)) !== null) {
    const name = topMatch[1] || "unknown";
    const argsText = (topMatch[2] ?? "").trim();
    const args = tryJsonParse(argsText) ?? { raw: argsText };
    calls.push({ id: `fn-${index++}`, name, arguments: args });
  }

  return calls;
}

function parseToolCalls(content: string): ToolCall[] {
  const xml = parseXmlToolCalls(content);
  const functions = parseFunctionCallToolCalls(content);
  const seen = new Set<string>();
  const calls: ToolCall[] = [];
  for (const call of [...xml, ...functions]) {
    const key = `${call.name}:${JSON.stringify(call.arguments)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(call);
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
        exampleArgs[p.name] = `\u003c${p.type}\u003e`;
      }
      const xmlExample = `\u003ctool name="${tool.name}"\u003e\n${JSON.stringify(exampleArgs, null, 2)}\n\u003c/tool\u003e`;
      const functionExample = `\u003cfunction=${tool.name}\u003e\n${JSON.stringify(exampleArgs, null, 2)}\n\u003c/function\u003e`;
      return `### ${tool.name}\n${tool.description}\nParameters:\n${params || "(none)"}\n\nYou can call it using either format:\n${xmlExample}\n\nOR\n${functionExample}`;
    })
    .join("\n\n");
  return `\n\nYou have access to the following tools. You may call them using either \u003ctool name="..."\u003e...\u003c/tool\u003e or \u003cfunction=...\u003e...\u003c/function\u003e blocks. When you have enough information, provide a final answer with no tool blocks.\n\n${defs}`;
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
          ? `${baseSystemPrompt}${toolsPrompt}`
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
