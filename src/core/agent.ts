import type { AgentManifest, SubTask, TaskResult, ModelChoice, TokenUsage, ConversationTurn } from "./types.js";
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



const TOOL_CALL_START = /^(?:\u003ctool\s+name=|\u003cfunction(?:=|\s)|call:tool:)/m;

function extractJsonBlock(text: string): string {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return "";
  let depth = 0;
  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(firstBrace, i + 1);
    }
  }
  return text.slice(firstBrace);
}

function looksLikeToolCall(content: string): boolean {
  return TOOL_CALL_START.test(content);
}

function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const seen = new Set<string>();
  let index = 0;

  // Find any known tool-call opener, then extract the first balanced JSON object
  // as the arguments. This tolerates mixed/malformed XML and oMLX native markers.
  const tokenizer = /(?:\u003ctool\s+name="([^"]+)"\s*\u003e|\u003cfunction=([^\u003e]+)\u003e|\u003cinvoke\s+name="([^"]+)"\u003e|call:tool:([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = tokenizer.exec(content)) !== null) {
    const name = (match[1] ?? match[2] ?? match[3] ?? match[4])?.trim();
    if (!name) continue;
    const rest = content.slice(match.index + match[0].length);
    const argsText = extractJsonBlock(rest);
    if (!argsText) continue;
    const args = tryJsonParse(argsText) ?? { raw: argsText };
    const key = `${name}:${JSON.stringify(args)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push({ id: `tool-${index++}`, name, arguments: args });
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
      const example = `call:tool:${tool.name}\n${JSON.stringify(exampleArgs, null, 2)}`;
      return `### ${tool.name}\n${tool.description}\nParameters:\n${params || "(none)"}\n\nCall it exactly like this:\n${example}`;
    })
    .join("\n\n");
  return `\n\nYou have access to the following tools. To call a tool, output ONLY a block starting with \`call:tool:<name>\` followed by a JSON object on the next lines. Do not wrap it in XML tags. Do not explain the tool call. When you have enough information, provide a final answer with no tool block.\n\n${defs}`;
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
        const conversation: ConversationTurn[] = [];

        const attempt = async (currentModel: ModelChoice): Promise<TaskResult> => {
          try {
            const basePrompt = this.buildPrompt(subTask);
            const baseSystemPrompt = this.buildSystemPrompt(subTask);
            const toolsPrompt = buildToolsSystemPrompt(this.tools);
            const systemPrompt = toolsPrompt
              ? `${baseSystemPrompt}${toolsPrompt}`
              : baseSystemPrompt;
            conversation.push({ role: "system", content: systemPrompt, timestamp: Date.now() });

            let prompt = basePrompt;
            let iteration = 0;
            let lastContent = "";

            while (iteration < MAX_TOOL_ITERATIONS) {
              conversation.push({ role: "user", content: prompt, timestamp: Date.now() });

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
              conversation.push({ role: "model", content: lastContent, timestamp: Date.now(), metadata: { model: result.model, provider: result.provider } });

              const toolCalls = parseToolCalls(lastContent);
              if (toolCalls.length === 0 || !this.tools) {
                // If the model emitted something that looks like a tool call but we
                // could not parse it, keep looping so we can feed it back as an error.
                if (looksLikeToolCall(lastContent) && iteration + 1 < MAX_TOOL_ITERATIONS) {
                  prompt = `${basePrompt}\n\nYour previous response contained an invalid or unparsable tool block:\n${lastContent}\n\nPlease provide a valid tool call using \`call:tool:<name>\` followed by a JSON object, or answer directly if no tool is needed.`;
                  iteration++;
                  continue;
                }
                break;
              }

              const toolResults = await Promise.all(toolCalls.map((call) => this.tools!.execute(call)));
              for (const tr of toolResults) {
                conversation.push({ role: "tool", content: JSON.stringify(tr), timestamp: Date.now(), metadata: { toolName: tr.name, success: tr.success } });
              }
              prompt = `${basePrompt}\n\nYour previous response:\n${lastContent}\n\n${formatToolResults(toolResults)}\n\nContinue or provide a final answer. If a tool failed or does not exist, do not call it again; answer based on what you already know.`;
              iteration++;
            }

            // If the final response still contains an unexecuted tool-like block,
            // do not treat it as a successful final answer.
            if (looksLikeToolCall(lastContent)) {
              return {
                subTaskId: subTask.id,
                output: null,
                success: false,
                error: `Model returned a tool-like block but the tool loop did not execute it. Raw output: ${lastContent.slice(0, 500)}`,
                actualTokens: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
                actualCost: this.calculateCost({ input: totalInput, output: totalOutput, total: totalInput + totalOutput }, currentModel),
                modelUsed: currentModel,
                latencyMs: Date.now() - startedAt,
                retries,
                conversation,
              };
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
              conversation,
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
              conversation.length = 0;
              return attempt(currentModel.fallback);
            }

            return {
              subTaskId: subTask.id,
              output: null,
              success: false,
              error: this.formatError(err),
              actualTokens: { input: 0, output: 0, total: 0 },
              actualCost: 0,
              modelUsed: currentModel,
              latencyMs: Date.now() - startedAt,
              retries,
              conversation,
            };
          }
        };

    const result = await attempt(model);
    this.endSpan(span!, { success: result.success, retries: result.retries });
    return result;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      const cause = err.cause instanceof Error ? ` [cause: ${err.cause.message}]` : "";
      return `${err.message}${cause}`;
    }
    return String(err);
  }

  protected abstract buildPrompt(subTask: SubTask): string;
  protected abstract buildSystemPrompt(subTask: SubTask): string;
  protected abstract parseOutput(raw: string, subTask: SubTask): unknown;

  protected calculateCost(usage: TokenUsage, model: ModelChoice): number {
    return model.estimatedCost;
  }
}
