import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { Agent } from "../core/agent.js";

export class AnalysisAgent extends Agent implements IAgent {
  readonly name = "AnalysisAgent";
  readonly manifest: AgentManifest = {
    id: "analysis-agent",
    tags: ["analysis", "reasoning"],
    complexityRange: [3, 7],
    tokenProfile: { min: 500, max: 4000, typical: 1500 },
    preferredModels: ["qwen"],
    timeoutMs: 60000,
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
    return `Analyze: ${subTask.description}\n\nData / context: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code and data analysis agent. Identify patterns, issues, risks, and opportunities. You may read files or list directories if context is insufficient. Be thorough and precise. Structure your output clearly.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { analysis: raw };
  }
}
