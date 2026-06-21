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

  constructor(llmCaller: ILLMCaller, estimatorModel: string) {
    super();
    this.llmCaller = llmCaller;
    this.estimatorModel = estimatorModel;
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
        provider: this.llmCaller.provider,
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 600,
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
    try {
      return JSON.parse(content) as ComplexityOutput;
    } catch (err) {
      throw new Error(`Estimator returned invalid JSON: ${err instanceof Error ? err.message : String(err)}. Content: ${content.slice(0, 500)}`);
    }
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
}

const SYSTEM_PROMPT = `You are a task complexity analyzer. Score tasks from 1 (trivial) to 10 (extremely complex). Consider ambiguity, domain knowledge, number of steps, need for external data, and reasoning depth. Be conservative — prefer slightly higher scores when uncertain. Always respond with valid JSON only.`;
