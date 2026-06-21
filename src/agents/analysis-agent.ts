import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import { Agent } from "../core/agent.js";

export class AnalysisAgent extends Agent implements IAgent {
  readonly name = "AnalysisAgent";
  readonly manifest: AgentManifest = {
    id: "analysis-agent",
    tags: ["analysis", "reasoning"],
    complexityRange: [3, 7],
    tokenProfile: { min: 500, max: 4000, typical: 1500 },
    preferredModels: ["gpt-4o", "claude-sonnet-4"],
    timeoutMs: 60000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Analyze: ${subTask.description}\n\nData / context: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code and data analysis agent. Identify patterns, issues, risks, and opportunities. Be thorough and precise. Structure your output clearly.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { analysis: raw };
  }
}
