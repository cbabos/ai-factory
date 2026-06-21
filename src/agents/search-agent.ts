import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { Agent } from "../core/agent.js";

export class SearchAgent extends Agent implements IAgent {
  readonly name = "SearchAgent";
  readonly manifest: AgentManifest = {
    id: "search-agent",
    tags: ["search", "codebase", "read-only"],
    complexityRange: [1, 4],
    tokenProfile: { min: 200, max: 2000, typical: 800 },
    preferredModels: ["qwen"],
    timeoutMs: 30000,
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
    return `Search request: ${subTask.description}\n\nContext: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a codebase search agent. Find relevant files, functions, and patterns. You may list directories or read files to gather information. Return precise file paths and summaries. Be concise.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { findings: raw };
  }
}
