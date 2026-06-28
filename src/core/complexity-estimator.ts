import type { Task, ComplexityScore, TokenEstimate, ConversationTurn } from "./types.js";
import type { IComplexityEstimator, ILLMCaller, LLMCallResult, EstimationResult } from "./interfaces.js";
import { PipelineStep } from "./pipeline-step.js";

interface ComplexityOutput {
  score: number;
  confidence: number;
  reasoning: string;
  estimatedTokens: TokenEstimate;
}

export class ComplexityEstimator
  extends PipelineStep<Task, EstimationResult>
  implements IComplexityEstimator
{
  readonly name = "ComplexityEstimator";

  private llmCaller: ILLMCaller;
  private estimatorModel: string;
  private estimatorProvider: string;

  constructor(llmCaller: ILLMCaller, estimatorModel: string, estimatorProvider?: string) {
    super();
    this.llmCaller = llmCaller;
    this.estimatorModel = estimatorModel;
    this.estimatorProvider = estimatorProvider ?? llmCaller.provider;
  }

  async execute(task: Task): Promise<EstimationResult> {
    const span = this.startSpan("estimate");
    const prompt = this.buildPrompt(task);
    const conversation: ConversationTurn[] = [
      { role: "system", content: SYSTEM_PROMPT, timestamp: Date.now() },
    ];

    try {
      const result: LLMCallResult = await this.llmCaller.call(prompt, {
        model: this.estimatorModel,
        provider: this.estimatorProvider,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 32768,
        responseFormat: "json",
      });
      conversation.push(
        { role: "user", content: prompt, timestamp: Date.now() },
        { role: "model", content: result.content, timestamp: Date.now(), metadata: { model: result.model, provider: result.provider } },
      );

      const parsed = this.parseStructured(result.content);
      const score: ComplexityScore = {
        score: Math.max(1, Math.min(10, Math.round(parsed.score))),
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning,
        estimatedTokens: this.normalizeEstimate(parsed.estimatedTokens),
      };

      this.endSpan(span!, {
        score: score.score,
        confidence: score.confidence,
        estimatedTokens: score.estimatedTokens.expected,
      });

      return { score, conversation };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      conversation.push({ role: "tool", content: `Error: ${error}`, timestamp: Date.now(), metadata: { phase: "estimation" } });
      this.endSpan(span!, { success: false, error });
      throw Object.assign(new Error(error), { conversation });
    }
  }

  private parseStructured(content: string): ComplexityOutput {
    const sanitizedContent = this.stripJsonFence(content);
    const firstJson = this.extractFirstJsonObject(sanitizedContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(firstJson) as unknown;
    } catch (err) {
      throw new Error(`Estimator returned invalid JSON: ${err instanceof Error ? err.message : String(err)}. Content: ${content.slice(0, 500)}`);
    }
    try {
      return this.validateStructured(parsed);
    } catch (err) {
      throw new Error(`Estimator returned invalid structure: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private extractFirstJsonObject(content: string): string {
    const trimmed = content.trim();
    // Some local/quantized models stream or repeat the JSON object multiple
    // times inside a single completion. Take the first complete top-level
    // value (object or array) and ignore trailing repetitions.
    let objectDepth = 0;
    let arrayDepth = 0;
    let inString = false;
    let escape = false;
    let firstValueStart = -1;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        if (objectDepth === 0 && arrayDepth === 0) {
          firstValueStart = i;
        }
        objectDepth += 1;
      } else if (ch === "}") {
        objectDepth -= 1;
        if (objectDepth === 0 && arrayDepth === 0 && firstValueStart !== -1) {
          return trimmed.slice(firstValueStart, i + 1);
        }
      } else if (ch === "[") {
        if (objectDepth === 0 && arrayDepth === 0) {
          firstValueStart = i;
        }
        arrayDepth += 1;
      } else if (ch === "]") {
        arrayDepth -= 1;
        if (objectDepth === 0 && arrayDepth === 0 && firstValueStart !== -1) {
          return trimmed.slice(firstValueStart, i + 1);
        }
      }
    }
    return trimmed;
  }

  private buildPrompt(task: Task): string {
    return `Analyze the complexity of this task and return a JSON object.

Task description: ${task.description}
Priority: ${task.priority}
Context: ${JSON.stringify(task.context, null, 2)}
Constraints: ${JSON.stringify(task.constraints ?? {}, null, 2)}

Respond with exactly this JSON structure:
{
  "score": number,        // 1-10, where 1 is trivial and 10 is extremely complex
  "confidence": number,   // 0.0-1.0
  "reasoning": string,    // brief explanation
  "estimatedTokens": {
    "min": number,
    "max": number,
    "expected": number
  }
}

Guidelines for score:
1: direct lookup or single-line answer
3: simple transformation or short explanation
5: moderate reasoning with multiple steps
7: research, analysis, or multi-file coordination
10: complex architecture, novel reasoning, or large-scale generation`;
  }

  private normalizeEstimate(est: TokenEstimate): TokenEstimate {
    const min = Math.max(0, Math.round(est.min));
    const expected = Math.max(min, Math.round(est.expected));
    const max = Math.max(expected, Math.round(est.max));
    return { min, max, expected };
  }

  private stripJsonFence(content: string): string {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fencedMatch?.[1] ?? trimmed;
  }

  private validateStructured(parsed: unknown): ComplexityOutput {
    const normalized = this.unwrapSingleEstimate(parsed);
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new Error("Estimator output must be an object");
    }

    const candidate = normalized as Record<string, unknown>;
    if (typeof candidate.score !== "number" || Number.isNaN(candidate.score)) {
      throw new Error("Estimator output score must be a number");
    }
    if (typeof candidate.confidence !== "number" || Number.isNaN(candidate.confidence)) {
      throw new Error("Estimator output confidence must be a number");
    }
    if (typeof candidate.reasoning !== "string") {
      throw new Error("Estimator output reasoning must be a string");
    }
    if (!candidate.estimatedTokens || typeof candidate.estimatedTokens !== "object" || Array.isArray(candidate.estimatedTokens)) {
      throw new Error("Estimator output estimatedTokens must be an object");
    }

    const estimatedTokens = candidate.estimatedTokens as Record<string, unknown>;
    if (typeof estimatedTokens.min !== "number" || Number.isNaN(estimatedTokens.min)) {
      throw new Error("Estimator output estimatedTokens.min must be a number");
    }
    if (typeof estimatedTokens.expected !== "number" || Number.isNaN(estimatedTokens.expected)) {
      throw new Error("Estimator output estimatedTokens.expected must be a number");
    }
    if (typeof estimatedTokens.max !== "number" || Number.isNaN(estimatedTokens.max)) {
      throw new Error("Estimator output estimatedTokens.max must be a number");
    }

    return {
      score: candidate.score,
      confidence: candidate.confidence,
      reasoning: candidate.reasoning,
      estimatedTokens: {
        min: estimatedTokens.min,
        expected: estimatedTokens.expected,
        max: estimatedTokens.max,
      },
    };
  }

  private unwrapSingleEstimate(parsed: unknown): unknown {
    if (!Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.length !== 1) {
      throw new Error("Estimator output array must contain exactly one item");
    }
    return parsed[0];
  }
}

const SYSTEM_PROMPT = `You are a task complexity analyzer. Score tasks from 1 (trivial) to 10 (extremely complex). Consider ambiguity, domain knowledge, number of steps, need for external data, and reasoning depth. Be conservative — prefer slightly higher scores when uncertain. Always respond with valid JSON only.`;
