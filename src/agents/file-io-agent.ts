import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import { Agent } from "../core/agent.js";

export class FileIOAgent extends Agent implements IAgent {
  readonly name = "FileIOAgent";
  readonly manifest: AgentManifest = {
    id: "file-io-agent",
    tags: ["file-io", "read-only", "write"],
    complexityRange: [1, 3],
    tokenProfile: { min: 100, max: 1000, typical: 400 },
    preferredModels: ["gpt-4o-mini", "claude-haiku-3-5", "gemini-flash-2.5"],
    timeoutMs: 15000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `File operation: ${subTask.description}\n\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a file I/O agent. Read, write, and list files. Return file contents or operation results concisely.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { result: raw };
  }
}
