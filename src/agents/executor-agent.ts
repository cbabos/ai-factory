import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { Agent } from "../core/agent.js";

export class ExecutorAgent extends Agent implements IAgent {
  readonly name = "ExecutorAgent";
  readonly manifest: AgentManifest = {
    id: "executor-agent",
    tags: ["execution", "code-generation", "write"],
    complexityRange: [3, 8],
    timeoutMs: 120000,
    maxRetries: 1,
  };

  readonly llmCaller: ILLMCaller;
  protected tools?: IToolRegistry;

  constructor(llmCaller: ILLMCaller, tools?: IToolRegistry) {
    super();
    this.llmCaller = llmCaller;
    this.tools = tools;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Generate, execute, or implement the following. You may read files, list directories, or write files if needed.\n\nRequest: ${subTask.description}\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code execution agent. Generate working code, commands, or actions. Prefer correctness over cleverness. Use file tools when you need to inspect or modify files. When the task says to write output to a specific file path, call writeFile with that path once you have the content, then provide a concise confirmation. Do not repeat tool calls you already executed in this conversation.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { code: raw };
  }
}
