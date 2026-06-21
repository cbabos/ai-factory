import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import { Agent } from "../core/agent.js";

export class SearchAgent extends Agent implements IAgent {
  readonly name = "SearchAgent";
  readonly manifest: AgentManifest = {
    id: "search-agent",
    tags: ["search", "codebase", "read-only"],
    complexityRange: [1, 4],
    tokenProfile: { min: 200, max: 2000, typical: 800 },
    preferredModels: ["gpt-4o-mini", "claude-haiku-3-5", "gemini-flash-2.5"],
    timeoutMs: 30000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Search request: ${subTask.description}\n\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a codebase search agent. Find relevant files, functions, and patterns. Return precise file paths and line numbers when possible. Be concise.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { findings: raw };
  }
}
