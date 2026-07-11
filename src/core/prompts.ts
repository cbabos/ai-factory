import type { Task, ComplexityScore } from "./types.js";
import type { IToolRegistry } from "../tools/interfaces.js";

// =============================================================================
// Complexity estimator
// =============================================================================

export const COMPLEXITY_ESTIMATOR_SYSTEM_PROMPT = `You are a task complexity analyzer. 
Score tasks from 1 (trivial) to 10 (extremely complex). 
Consider ambiguity, domain knowledge, number of steps, need for external data, and reasoning depth. 
Be conservative — prefer slightly higher scores when uncertain. Always respond with valid JSON only.`;

export function buildComplexityEstimatorUserPrompt(task: Task): string {
  return `Analyze the complexity of this task and return a JSON object.

Task description: ${task.description}
${task.priority ? `Priority: ${task.priority}`: ``}
${task.context ? `Context: ${JSON.stringify(task.context, null, 2)}` : ``}
${task.constraints ? `Constraints: ${JSON.stringify(task.constraints ?? {}, null, 2)}` : ``}

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
10: complex architecture, novel reasoning, or large-scale generation

** ALWAYS use the JSON structure **`;
}

// =============================================================================
// Task decomposer
// =============================================================================

export const TASK_DECOMPOSER_SYSTEM_PROMPT = `You are a task decomposition specialist. 
Break complex tasks into the smallest possible independent sub-tasks. 
Each sub-task should be simple enough for a single-purpose agent. 
Prefer more, simpler sub-tasks over fewer, complex ones. 
You must follow the requested schema exactly. 
Return a single valid JSON object only, with no markdown fences, no commentary, no extra keys, and no alternative field names.`;

export const TASK_DECOMPOSER_REPAIR_SYSTEM_PROMPT = `You repair malformed JSON. 
Return valid JSON only, preserve the intended structure and values, and never include markdown fences or commentary.`;

export function buildTaskDecomposerUserPrompt(
  task: Task,
  score: ComplexityScore,
  availableTags: string[],
): string {
  return `Decompose this complex task into smaller, independently executable sub-tasks.

You **must follow the output schema exactly**. Return valid JSON only.

Original task: ${task.description}
Parent complexity score: ${score.score}/10
Reasoning: ${score.reasoning}
${task.priority ? `Priority: ${task.priority}`: ``}
${task.context ? `Context: ${JSON.stringify(task.context, null, 2)}` : ``}
${task.constraints ? `Constraints: ${JSON.stringify(task.constraints ?? {}, null, 2)}` : ``}

Rules:
- Use capability tags from this curated set: [${availableTags.join(", ")}].
- Prefer the smallest accurate set of tags for each sub-task instead of broad tag stuffing.
- Each sub-task must be simple enough for a single-purpose agent.
- Each sub-task gets its own complexity score (must be lower or equal than the parent's ${score.score}).
- Aim for the minimum amount of low-complexity tasks necessary to 100% fullfill the ask, keeping in mind verification is needed for all steps. 
- estimatedTokens: { min, max, expected }
- The top-level JSON value must be an object, not an array.
- The top-level object must contain exactly one key: "subTasks".
- "subTasks" must be an array of objects.
- Each sub-task object must contain exactly these keys:
  "id", "description", "capabilityTags", "dependencies", "complexity"
- Do not add extra keys such as "title", "name", "description_code", "notes", or "metadata".
- "description" must be a non-empty string.
- "capabilityTags" must be an array using only values from the curated set above.
- "dependencies" must be an array of integers referencing **earlier sub-task IDs only**.
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
- Before replying verify the generated content.

- **DO NOT REPEAT the json**

Return exactly:
{
  "subTasks": [
    {
      "id": number,
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

export function buildTaskDecomposerRepairPrompt(content: string): string {
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

// =============================================================================
// Agent tool loop
// =============================================================================

export const AGENT_TOOL_CALLING_PREFIX = `You have access to the following tools. 
To call a tool, output ONLY a block starting with \`call:tool:<name>\` followed by a JSON object on the next lines. 
Do not wrap it in XML tags. Do not explain the tool call. 
When you have enough information, provide a final answer with no tool block.`;

export function buildAgentToolSystemPrompt(tools?: IToolRegistry): string {
  if (!tools || tools.list().length === 0) {
    return "";
  }

  const definitions = tools
    .list()
    .map((tool) => {
      const params = tool.parameters
        .map((p) => `- ${p.name}${p.required ? "" : "?"}: ${p.type} — ${p.description}`)
        .join("\n");

      const exampleArgs: Record<string, string> = {};
      for (const p of tool.parameters) {
        exampleArgs[p.name] = `<${p.type}>`;
      }
      const example = `call:tool:${tool.name}\n${JSON.stringify(exampleArgs, null, 2)}`;

      return `### ${tool.name}\n${tool.description}\nParameters:\n${params || "(none)"}\n\nCall it exactly like this:\n${example}`;
    })
    .join("\n\n");

  return `\n\n${AGENT_TOOL_CALLING_PREFIX}\n\n${definitions}`;
}

export const AGENT_TOOL_LOOP_NO_REPEAT_INSTRUCTION = "You already executed the following tool calls in this conversation; do not repeat them:";

export const AGENT_TOOL_LOOP_CONTINUE_INSTRUCTION = `Continue or provide a final answer. 
If a tool failed or does not exist, do not call it again; answer based on what you already know.`;

export function buildAgentToolLoopNoRepeatPrompt(
  basePrompt: string,
  toolCalls: { name: string; arguments: Record<string, unknown> }[],
  outputPath?: string,
): string {
  const writeHint = outputPath
    ? ` The task requires writing the result to ${outputPath}. Call writeFile with that path and the content you already have.`
    : " Provide a final answer with no tool block.";

  return `${basePrompt}\n\n${AGENT_TOOL_LOOP_NO_REPEAT_INSTRUCTION}\n${toolCalls.map((c) => `- ${c.name}: ${JSON.stringify(c.arguments)}`).join("\n")}${writeHint}`;
}

export function buildAgentToolLoopContinuePrompt(
  basePrompt: string,
  lastContent: string,
  toolResults: { name: string; success: boolean; output: unknown; error?: string }[],
): string {
  const formattedResults = toolResults
    .map((result) => {
      const errorPart = result.error ? `Error: ${result.error}\n` : "";
      return `<tool_result name="${result.name}" success="${result.success}">\n${JSON.stringify(result.output)}\n${errorPart}</tool_result>`;
    })
    .join("\n");

  return `${basePrompt}\n\nYour previous response:\n${lastContent}\n\n${formattedResults}\n\n${AGENT_TOOL_LOOP_CONTINUE_INSTRUCTION}`;
}

// =============================================================================
// Configurable agent defaults
// =============================================================================

export const CONFIGURABLE_AGENT_DEFAULT_BEHAVIOR = "Complete the task carefully and directly.";

export const CONFIGURABLE_AGENT_OUTPUT_CONTRACT_PREFIX = "Output contract:";

export const CONFIGURABLE_AGENT_TOOL_POLICY_PREFIX = "Tool policy:";

export const CONFIGURABLE_AGENT_NOTES_PREFIX = "Notes:";
