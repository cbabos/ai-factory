import { Agent } from "../core/agent.js";
import type { IAgent, ILLMCaller } from "../core/interfaces.js";
import type { AgentManifest, SubTask } from "../core/types.js";
import type { IToolRegistry } from "../tools/interfaces.js";
import { CONFIGURABLE_AGENT_DEFAULT_BEHAVIOR, CONFIGURABLE_AGENT_OUTPUT_CONTRACT_PREFIX, CONFIGURABLE_AGENT_TOOL_POLICY_PREFIX, CONFIGURABLE_AGENT_NOTES_PREFIX } from "../core/prompts.js";

interface ConfigurableAgentMetadata {
  systemPrompt?: unknown;
  outputContract?: unknown;
  toolPolicy?: unknown;
  notes?: unknown;
  promptTemplate?: unknown;
  outputMode?: unknown;
}

interface ConfigurableAgentInput {
  id: string;
  name: string;
  tags: string[];
  complexityMin: number;
  complexityMax: number;
  timeoutMs?: number;
  maxRetries?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function renderTemplate(template: string, subTask: SubTask): string {
  const replacements: Record<string, string> = {
    "{{subtask.description}}": subTask.description,
    "{{subtask.context}}": JSON.stringify(subTask.context, null, 2),
    "{{subtask.tags}}": subTask.capabilityTags.join(", "),
    "{{subtask.priority}}": subTask.priority,
    "{{model.provider}}": subTask.assignedModel?.provider ?? "",
    "{{model.id}}": subTask.assignedModel?.modelId ?? "",
  };

  let rendered = template;
  for (const [token, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(token, value);
  }
  return rendered;
}

export class ConfigurableAgent extends Agent implements IAgent {
  readonly name: string;
  readonly manifest: AgentManifest;
  readonly llmCaller: ILLMCaller;

  protected tools?: IToolRegistry;

  private readonly description?: string;
  private readonly metadata: ConfigurableAgentMetadata;

  constructor(
    input: ConfigurableAgentInput,
    llmCaller: ILLMCaller,
    tools?: IToolRegistry,
  ) {
    super();
    this.name = input.name;
    this.llmCaller = llmCaller;
    this.tools = tools;
    this.description = input.description;
    this.metadata = input.metadata ?? {};
    this.manifest = {
      id: input.id,
      tags: input.tags,
      complexityRange: [input.complexityMin, input.complexityMax],
      timeoutMs: input.timeoutMs ?? 30000,
      maxRetries: input.maxRetries ?? 2,
    };
  }

  protected buildPrompt(subTask: SubTask): string {
    const template = getString(this.metadata.promptTemplate);
    if (template) {
      return renderTemplate(template, subTask);
    }

    const sections = [
      `Task: ${subTask.description}`,
      `Context: ${JSON.stringify(subTask.context, null, 2)}`,
    ];

    const outputContract = getString(this.metadata.outputContract);
    if (outputContract) {
      sections.push(`${CONFIGURABLE_AGENT_OUTPUT_CONTRACT_PREFIX}\n${outputContract}`);
    }

    return sections.join("\n\n");
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    const sections: string[] = [];
    const systemPrompt = getString(this.metadata.systemPrompt);

    if (systemPrompt) {
      sections.push(systemPrompt);
    } else {
      const intro = this.description
        ? `You are ${this.name}. ${this.description}`
        : `You are ${this.name}.`;
      sections.push(`${intro} ${CONFIGURABLE_AGENT_DEFAULT_BEHAVIOR}`);
    }

    const toolPolicy = getString(this.metadata.toolPolicy);
    if (toolPolicy) {
      sections.push(`${CONFIGURABLE_AGENT_TOOL_POLICY_PREFIX}\n${toolPolicy}`);
    }

    const notes = getString(this.metadata.notes);
    if (notes) {
      sections.push(`${CONFIGURABLE_AGENT_NOTES_PREFIX}\n${notes}`);
    }

    return sections.join("\n\n");
  }

  protected parseOutput(raw: string): unknown {
    const outputMode = getString(this.metadata.outputMode);
    if (outputMode === "json") {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    }
    return raw;
  }
}
