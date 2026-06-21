import type { Task, ComplexityScore, TokenEstimate, ConversationTurn } from "./types.js";
import type { ITaskDecomposer, ILLMCaller, LLMCallResult, DecompositionResult } from "./interfaces.js";

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
  private llmCaller: ILLMCaller;
  private decomposerModel: string;

  constructor(llmCaller: ILLMCaller, decomposerModel: string) {
    this.llmCaller = llmCaller;
    this.decomposerModel = decomposerModel;
  }

  async decompose(task: Task, score: ComplexityScore): Promise<DecompositionResult> {
    const prompt = this.buildPrompt(task, score);
    const conversation: ConversationTurn[] = [
      { role: "system", content: SYSTEM_PROMPT, timestamp: Date.now() },
    ];

    try {
      const result: LLMCallResult = await this.llmCaller.call(prompt, {
        model: this.decomposerModel,
        provider: this.llmCaller.provider,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: "json",
      });
      conversation.push(
        { role: "user", content: prompt, timestamp: Date.now() },
        { role: "model", content: result.content, timestamp: Date.now(), metadata: { model: result.model, provider: result.provider } },
      );

      const parsed = this.parseStructured(result.content);
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

  private parseStructured(content: string): DecompositionOutput {
    try {
      return JSON.parse(content) as DecompositionOutput;
    } catch (err) {
      throw new Error(`Decomposer returned invalid JSON: ${err instanceof Error ? err.message : String(err)}. Content: ${content.slice(0, 500)}`);
    }
  }

  private buildPrompt(task: Task, score: ComplexityScore): string {
    return `Decompose this complex task into smaller, independently executable sub-tasks. Return valid JSON only.

Original task: ${task.description}
Parent complexity score: ${score.score}/10
Reasoning: ${score.reasoning}
Priority: ${task.priority}
Context: ${JSON.stringify(task.context, null, 2)}
Constraints: ${JSON.stringify(task.constraints ?? {}, null, 2)}

Rules:
- Each sub-task must be simple enough for a single-purpose agent.
- Use capability tags from this set: [search, codebase, read-only, analysis, reasoning, summarization, synthesis, execution, code-generation, write, file-io].
- dependencies are 0-based indices into the subTasks array. Sub-task 2 depends on sub-task 0 means dependencies: [0].
- Each sub-task gets its own complexity score (must be lower than the parent's ${score.score}).
- Aim for 2-6 sub-tasks.
- estimatedTokens: { min, max, expected }

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

  private normalizeEstimate(est: TokenEstimate): TokenEstimate {
    const min = Math.max(0, Math.round(est.min));
    const expected = Math.max(min, Math.round(est.expected));
    const max = Math.max(expected, Math.round(est.max));
    return { min, max, expected };
  }
}

const SYSTEM_PROMPT = `You are a task decomposition specialist. Break complex tasks into the smallest possible independent sub-tasks. Each sub-task should be simple enough for a single-purpose agent. Prefer more, simpler sub-tasks over fewer, complex ones. Always respond with valid JSON only.`;
