import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import { Agent } from "../core/agent.js";

export class ExecutorAgent extends Agent implements IAgent {
  readonly name = "ExecutorAgent";
  readonly manifest: AgentManifest = {
    id: "executor-agent",
    tags: ["execution", "code-generation", "write"],
    complexityRange: [3, 8],
    tokenProfile: { min: 500, max: 8000, typical: 2000 },
    preferredModels: ["gpt-4o", "claude-sonnet-4"],
    timeoutMs: 120000,
    maxRetries: 1,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Generate or execute the following. Be precise and safe.\n\nRequest: ${subTask.description}\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code execution agent. Generate working code, commands, or actions. Prefer correctness over cleverness. Include explanations only when asked.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { code: raw };
  }
}
