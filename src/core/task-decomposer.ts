import type { Task, ComplexityScore, TokenEstimate, ConversationTurn } from "./types.js";
import type { ITaskDecomposer, ILLMCaller, DecompositionResult } from "./interfaces.js";
import { getDefaultCapabilityTagIds } from "./tag-vocabulary.js";

interface DecomposedSubTask {
  description: string;
  capabilityTags: string[];
  dependencies: number[]; // indices into the subTasks array
  complexity: {
    score: number;
    confidence: number;
    reasoning: string;
    estimatedTokens: TokenEstimate;
  };
}

interface DecompositionOutput {
  subTasks: DecomposedSubTask[];
}

export class TaskDecomposer implements ITaskDecomposer {
  private static readonly MAX_PARSE_ATTEMPTS = 2;
  private llmCaller: ILLMCaller;
  private decomposerModel: string;
  private capabilityTagsProvider?: () => string[];
  private decomposerProvider: string;

  constructor(
    llmCaller: ILLMCaller,
    decomposerModel: string,
    capabilityTagsProvider?: () => string[],
    decomposerProvider?: string,
  ) {
    this.llmCaller = llmCaller;
    this.decomposerModel = decomposerModel;
    this.capabilityTagsProvider = capabilityTagsProvider;
    this.decomposerProvider = decomposerProvider ?? llmCaller.provider;
  }

  async decompose(task: Task, score: ComplexityScore): Promise<DecompositionResult> {
    const prompt = this.buildPrompt(task, score);
    const conversation: ConversationTurn[] = [
      { role: "system", content: SYSTEM_PROMPT, timestamp: Date.now() },
    ];

    try {
      conversation.push({ role: "user", content: prompt, timestamp: Date.now() });
      const parsed = await this.generateStructured(prompt, conversation);
      const subTasks = parsed.subTasks.map((st, i) => ({
        id: `${task.id}-sub-${i}`,
        parentTaskId: task.id,
        description: st.description,
        context: task.context,
        dependencies: st.dependencies.map((d) => `${task.id}-sub-${d}`),
        capabilityTags: st.capabilityTags,
        complexity: {
          score: Math.max(1, Math.min(10, Math.round(st.complexity.score))),
          confidence: Math.max(0, Math.min(1, st.complexity.confidence)),
          reasoning: st.complexity.reasoning,
          estimatedTokens: this.normalizeEstimate(st.complexity.estimatedTokens),
        },
        priority: task.priority,
      }));

      return { subTasks, conversation };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      conversation.push({ role: "tool", content: `Error: ${error}`, timestamp: Date.now(), metadata: { phase: "decomposition" } });
      throw Object.assign(new Error(error), { conversation });
    }
  }

  private async generateStructured(prompt: string, conversation: ConversationTurn[]): Promise<DecompositionOutput> {
    let lastInvalidContent = "";
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= TaskDecomposer.MAX_PARSE_ATTEMPTS; attempt += 1) {
      const result = await this.llmCaller.call(prompt, {
        model: this.decomposerModel,
        provider: this.decomposerProvider,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: "json",
      });
      conversation.push({
        role: "model",
        content: result.content,
        timestamp: Date.now(),
        metadata: { model: result.model, provider: result.provider, attempt },
      });

      try {
        return this.parseStructured(result.content);
      } catch (err) {
        if (!(err instanceof Error)) {
          throw err;
        }
        lastError = err;
        lastInvalidContent = result.content;

        if (!this.isRecoverableParseError(err) || attempt >= TaskDecomposer.MAX_PARSE_ATTEMPTS) {
          break;
        }

        conversation.push({
          role: "tool",
          content: `Retrying decomposition after malformed JSON on attempt ${attempt}.`,
          timestamp: Date.now(),
          metadata: { phase: "decomposition-retry", attempt },
        });
      }
    }

    if (lastError && lastInvalidContent && this.isRecoverableParseError(lastError)) {
      const repaired = await this.repairStructured(lastInvalidContent, conversation);
      return this.parseStructured(repaired);
    }

    throw lastError ?? new Error("Decomposer failed without a captured error");
  }

  private async repairStructured(content: string, conversation: ConversationTurn[]): Promise<string> {
    const prompt = this.buildRepairPrompt(content);
    conversation.push({ role: "user", content: prompt, timestamp: Date.now(), metadata: { phase: "decomposition-repair" } });
    const result = await this.llmCaller.call(prompt, {
      model: this.decomposerModel,
      provider: this.decomposerProvider,
      systemPrompt: REPAIR_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 2000,
      responseFormat: "json",
    });
    conversation.push({
      role: "model",
      content: result.content,
      timestamp: Date.now(),
      metadata: { model: result.model, provider: result.provider, phase: "decomposition-repair" },
    });
    return result.content;
  }

  private parseStructured(content: string): DecompositionOutput {
    const sanitizedContent = this.stripJsonFence(content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizedContent) as unknown;
    } catch (err) {
      throw new Error(`Decomposer returned invalid JSON: ${err instanceof Error ? err.message : String(err)}. Content: ${content.slice(0, 500)}`);
    }
    try {
      const normalized = this.normalizeStructured(parsed);
      this.validateStructured(normalized);
      return normalized;
    } catch (err) {
      throw new Error(`Decomposer returned invalid structure: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private buildPrompt(task: Task, score: ComplexityScore): string {
    const availableTags = this.resolveCapabilityTags();
    return `Decompose this complex task into smaller, independently executable sub-tasks.

You must follow the output schema exactly. Return valid JSON only.

Original task: ${task.description}
Parent complexity score: ${score.score}/10
Reasoning: ${score.reasoning}
Priority: ${task.priority}
Context: ${JSON.stringify(task.context, null, 2)}
Constraints: ${JSON.stringify(task.constraints ?? {}, null, 2)}

Rules:
- Each sub-task must be simple enough for a single-purpose agent.
- Use capability tags from this curated set: [${availableTags.join(", ")}].
- Prefer the smallest accurate set of tags for each sub-task instead of broad tag stuffing.
- dependencies are 0-based indices into the subTasks array. Sub-task 2 depends on sub-task 0 means dependencies: [0].
- Each sub-task gets its own complexity score (must be lower than the parent's ${score.score}).
- Aim for 2-6 sub-tasks.
- estimatedTokens: { min, max, expected }
- The top-level JSON value must be an object, not an array.
- The top-level object must contain exactly one key: "subTasks".
- "subTasks" must be an array of objects.
- Each sub-task object must contain exactly these keys:
  "description", "capabilityTags", "dependencies", "complexity"
- Do not add extra keys such as "title", "name", "description_code", "notes", or "metadata".
- "description" must be a non-empty string.
- "capabilityTags" must be an array using only values from the curated set above.
- "dependencies" must be an array of integers referencing earlier sub-task indices only.
- "complexity" must contain exactly these keys:
  "score", "confidence", "reasoning", "estimatedTokens"
- Do not rename fields. Use "confidence", never variants like "conf", "rating", or numeric keys such as "5".
- "score" must be a number.
- "confidence" must be a number between 0 and 1.
- "reasoning" must be a string.
- "estimatedTokens" must contain exactly these numeric keys:
  "min", "max", "expected"
- Do not wrap the response in markdown fences.
- Do not include commentary, explanations, prose, headings, or text before or after the JSON.
- If you are uncertain, still output the exact schema with best-effort values instead of inventing new fields.

Valid examples:
Example 1:
{
  "subTasks": [
    {
      "description": "Inspect the existing repository structure and identify the files relevant to authentication.",
      "capabilityTags": ["codebase", "analysis", "read-only"],
      "dependencies": [],
      "complexity": {
        "score": 3,
        "confidence": 0.92,
        "reasoning": "This is a small inspection task with no code changes.",
        "estimatedTokens": { "min": 120, "max": 300, "expected": 180 }
      }
    }
  ]
}

Example 2:
{
  "subTasks": [
    {
      "description": "Create the project directory and initialize the Node.js application with the required dependencies.",
      "capabilityTags": ["file-io", "execution", "code-generation"],
      "dependencies": [],
      "complexity": {
        "score": 4,
        "confidence": 0.88,
        "reasoning": "Project bootstrap is straightforward but touches filesystem and package setup.",
        "estimatedTokens": { "min": 180, "max": 420, "expected": 280 }
      }
    },
    {
      "description": "Define the initial database schema and data models for products, users, and orders.",
      "capabilityTags": ["code-generation", "data", "analysis"],
      "dependencies": [0],
      "complexity": {
        "score": 5,
        "confidence": 0.86,
        "reasoning": "Schema design depends on project setup and requires moderate reasoning.",
        "estimatedTokens": { "min": 220, "max": 520, "expected": 360 }
      }
    }
  ]
}

Example 3:
{
  "subTasks": [
    {
      "description": "Review the failing test output and identify the component causing the regression.",
      "capabilityTags": ["analysis", "reasoning", "read-only"],
      "dependencies": [],
      "complexity": {
        "score": 3,
        "confidence": 0.91,
        "reasoning": "This is a bounded debugging analysis task.",
        "estimatedTokens": { "min": 100, "max": 260, "expected": 160 }
      }
    },
    {
      "description": "Implement the code fix in the affected component and update any related logic.",
      "capabilityTags": ["code-generation", "write", "execution"],
      "dependencies": [0],
      "complexity": {
        "score": 4,
        "confidence": 0.84,
        "reasoning": "The fix requires code changes informed by the prior diagnosis.",
        "estimatedTokens": { "min": 160, "max": 380, "expected": 250 }
      }
    },
    {
      "description": "Run the relevant tests and summarize whether the regression is resolved.",
      "capabilityTags": ["execution", "analysis", "summarization"],
      "dependencies": [1],
      "complexity": {
        "score": 3,
        "confidence": 0.9,
        "reasoning": "Verification is procedural and depends on the implemented fix.",
        "estimatedTokens": { "min": 90, "max": 220, "expected": 140 }
      }
    }
  ]
}

Return exactly:
{
  "subTasks": [
    {
      "description": string,
      "capabilityTags": string[],
      "dependencies": number[],
      "complexity": {
        "score": number,
        "confidence": number,
        "reasoning": string,
        "estimatedTokens": { "min": number, "max": number, "expected": number }
      }
    }
  ]
}`;
  }

  private resolveCapabilityTags(): string[] {
    const configured = this.capabilityTagsProvider?.() ?? [];
    const normalized = configured
      .map((tag) => tag.trim())
      .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);

    return normalized.length > 0 ? normalized : getDefaultCapabilityTagIds();
  }

  private stripJsonFence(content: string): string {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fencedMatch?.[1] ?? trimmed;
  }

  private buildRepairPrompt(content: string): string {
    return `Repair the following malformed JSON into valid JSON.

Rules:
- Return valid JSON only.
- Preserve the original intent and fields.
- Do not add markdown fences or explanations.
- Keep the same schema:
{
  "subTasks": [
    {
      "description": string,
      "capabilityTags": string[],
      "dependencies": number[],
      "complexity": {
        "score": number,
        "confidence": number,
        "reasoning": string,
        "estimatedTokens": { "min": number, "max": number, "expected": number }
      }
    }
  ]
}

Malformed JSON:
${content}`;
  }

  private isRecoverableParseError(err: Error): boolean {
    return err.message.startsWith("Decomposer returned invalid JSON:");
  }

  private normalizeStructured(parsed: unknown): DecompositionOutput {
    if (Array.isArray(parsed)) {
      return { subTasks: parsed as DecomposedSubTask[] };
    }
    return parsed as DecompositionOutput;
  }

  private validateStructured(parsed: DecompositionOutput): void {
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.subTasks)) {
      throw new Error("Decomposer output must be an object with a subTasks array");
    }

    const allowedTags = new Set(this.resolveCapabilityTags());
    const subTaskCount = parsed.subTasks.length;

    parsed.subTasks.forEach((subTask, index) => {
      if (typeof subTask.description !== "string" || subTask.description.trim().length === 0) {
        throw new Error(`Sub-task ${index} description must be a non-empty string`);
      }
      if (!Array.isArray(subTask.capabilityTags)) {
        throw new Error(`Sub-task ${index} capabilityTags must be an array`);
      }
      if (!Array.isArray(subTask.dependencies)) {
        throw new Error(`Sub-task ${index} dependencies must be an array`);
      }
      if (!subTask.complexity || typeof subTask.complexity !== "object") {
        throw new Error(`Sub-task ${index} complexity must be an object`);
      }

      const invalidTags = subTask.capabilityTags.filter((tag) => !allowedTags.has(tag));
      if (invalidTags.length > 0) {
        throw new Error(
          `Sub-task ${index} uses unsupported capability tags: ${invalidTags.join(", ")}. Allowed tags: ${Array.from(allowedTags).join(", ")}`,
        );
      }

      if (typeof subTask.complexity.score !== "number" || Number.isNaN(subTask.complexity.score)) {
        throw new Error(`Sub-task ${index} complexity.score must be a number`);
      }
      if (typeof subTask.complexity.confidence !== "number" || Number.isNaN(subTask.complexity.confidence)) {
        throw new Error(`Sub-task ${index} complexity.confidence must be a number`);
      }
      if (typeof subTask.complexity.reasoning !== "string") {
        throw new Error(`Sub-task ${index} complexity.reasoning must be a string`);
      }
      if (
        !subTask.complexity.estimatedTokens
        || typeof subTask.complexity.estimatedTokens !== "object"
        || Array.isArray(subTask.complexity.estimatedTokens)
      ) {
        throw new Error(`Sub-task ${index} complexity.estimatedTokens must be an object`);
      }
      if (
        typeof subTask.complexity.estimatedTokens.min !== "number"
        || Number.isNaN(subTask.complexity.estimatedTokens.min)
      ) {
        throw new Error(`Sub-task ${index} complexity.estimatedTokens.min must be a number`);
      }
      if (
        typeof subTask.complexity.estimatedTokens.expected !== "number"
        || Number.isNaN(subTask.complexity.estimatedTokens.expected)
      ) {
        throw new Error(`Sub-task ${index} complexity.estimatedTokens.expected must be a number`);
      }
      if (
        typeof subTask.complexity.estimatedTokens.max !== "number"
        || Number.isNaN(subTask.complexity.estimatedTokens.max)
      ) {
        throw new Error(`Sub-task ${index} complexity.estimatedTokens.max must be a number`);
      }

      subTask.dependencies.forEach((dependency) => {
        if (!Number.isInteger(dependency) || dependency < 0 || dependency >= subTaskCount) {
          throw new Error(`Sub-task ${index} has invalid dependency index ${dependency}`);
        }
        if (dependency === index) {
          throw new Error(`Sub-task ${index} cannot depend on itself`);
        }
        if (dependency > index) {
          throw new Error(
            `Sub-task ${index} depends on future sub-task ${dependency}. Dependencies must reference earlier sub-tasks.`,
          );
        }
      });
    });
  }

  private normalizeEstimate(est: TokenEstimate): TokenEstimate {
    const min = Math.max(0, Math.round(est.min));
    const expected = Math.max(min, Math.round(est.expected));
    const max = Math.max(expected, Math.round(est.max));
    return { min, max, expected };
  }
}

const SYSTEM_PROMPT = `You are a task decomposition specialist. Break complex tasks into the smallest possible independent sub-tasks. Each sub-task should be simple enough for a single-purpose agent. Prefer more, simpler sub-tasks over fewer, complex ones. You must follow the requested schema exactly. Return a single valid JSON object only, with no markdown fences, no commentary, no extra keys, and no alternative field names.`;
const REPAIR_SYSTEM_PROMPT = `You repair malformed JSON. Return valid JSON only, preserve the intended structure and values, and never include markdown fences or commentary.`;
