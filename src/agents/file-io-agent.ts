import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { Agent } from "../core/agent.js";

export class FileIOAgent extends Agent implements IAgent {
  readonly name = "FileIOAgent";
  readonly manifest: AgentManifest = {
    id: "file-io-agent",
    tags: ["file-io", "read-only", "write"],
    complexityRange: [1, 3],
    timeoutMs: 15000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;
  protected tools?: IToolRegistry;

  constructor(llmCaller: ILLMCaller, tools?: IToolRegistry) {
    super();
    this.llmCaller = llmCaller;
    this.tools = tools;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `File operation: ${subTask.description}\n\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a file I/O agent. Read, list, and write files as needed. Use the provided file tools. When the task says to write output to a specific file path, call writeFile with that path once you have the content, then provide a concise confirmation. Do not repeat tool calls you already executed in this conversation.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { result: raw };
  }
}
