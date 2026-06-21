import type { AgentManifest, SubTask } from "../core/types.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { Agent } from "../core/agent.js";

export class SummarizerAgent extends Agent implements IAgent {
  readonly name = "SummarizerAgent";
  readonly manifest: AgentManifest = {
    id: "summarizer-agent",
    tags: ["summarization", "synthesis"],
    complexityRange: [1, 5],
    tokenProfile: { min: 200, max: 1500, typical: 600 },
    timeoutMs: 30000,
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
    return `Summarize the following into a concise, accurate summary.\n\nInput: ${JSON.stringify(subTask.context, null, 2)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a summarization agent. Produce concise, accurate summaries. Preserve key facts, omit filler. You may list directories or read files if the input references paths.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { summary: raw };
  }
}
