import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ILLMCaller, LLMCallOptions, LLMCallResult } from "../interfaces.js";
import type { SubTask } from "../types.js";
import { Agent } from "../agent.js";
import { ToolRegistry } from "../../tools/tool-registry.js";
import { ReadFileTool, WriteFileTool, ListDirectoryTool } from "../../tools/file-tools.js";
import type { IToolRegistry } from "../../tools/interfaces.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

class TestAgent extends Agent {
  readonly name = "TestAgent";
  readonly manifest = {
    id: "test-agent",
    tags: ["test"],
    complexityRange: [1, 10] as [number, number],
    tokenProfile: { min: 10, max: 1000, typical: 100 },
    preferredModels: [],
    timeoutMs: 5000,
    maxRetries: 0,
  };
  readonly llmCaller: ILLMCaller;
  protected tools?: IToolRegistry;

  constructor(llmCaller: ILLMCaller, tools?: IToolRegistry) {
    super();
    this.llmCaller = llmCaller;
    this.tools = tools;
  }

  protected buildPrompt(): string {
    return "Do something";
  }
  protected buildSystemPrompt(): string {
    return "You are a test agent.";
  }
  protected parseOutput(raw: string): unknown {
    return { result: raw };
  }
}

function makeCaller(responses: string[]): ILLMCaller {
  let index = 0;
  const call = vi.fn().mockImplementation(async (_prompt: string, _options: LLMCallOptions): Promise<LLMCallResult> => {
    const content = responses[index++] ?? "";
    return {
      content,
      usage: { input: 10, output: content.length, total: 10 + content.length },
      model: "qwen",
      provider: "omlx",
      latencyMs: 1,
    };
  });
  return {
    provider: "omlx",
    call,
    callStructured: vi.fn(),
    estimateTokens: vi.fn().mockReturnValue(10),
    listModels: vi.fn(),
  };
}

function makeSubTask(): SubTask {
  return {
    id: "s1",
    parentTaskId: "t1",
    description: "Do something",
    context: {},
    dependencies: [],
    capabilityTags: ["test"],
    complexity: { score: 3, confidence: 0.9, reasoning: "ok", estimatedTokens: { min: 10, max: 100, expected: 50 } },
    priority: "normal",
    assignedModel: {
      provider: "omlx",
      modelId: "qwen",
      estimatedTokens: { min: 10, max: 100, expected: 50 },
      estimatedCost: 0,
    },
  };
}

describe("Agent tool parsing", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agent-tools-"));
    writeFileSync(join(tmpDir, "foo.txt"), "bar", "utf-8");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(new ReadFileTool(tmpDir));
    registry.register(new WriteFileTool(tmpDir));
    registry.register(new ListDirectoryTool(tmpDir));
    return registry;
  }

  it("executes XML-style tool calls", async () => {
    const responses = [
      `\u003ctool name="readFile"\u003e\n{"path":"foo.txt"}\n\u003c/tool\u003e`,
      "The file contains bar",
    ];
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "The file contains bar" });
    expect(caller.call).toHaveBeenCalledTimes(2);
  });

  it("executes function-style tool calls", async () => {
    const responses = [
      `\u003cfunction=readFile\u003e\n{"path":"foo.txt"}\n\u003c/function\u003e`,
      "The file contains bar",
    ];
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "The file contains bar" });
    expect(caller.call).toHaveBeenCalledTimes(2);
  });

  it("executes wrapped function_calls", async () => {
    const responses = [
      `\u003cfunction_calls\u003e\u003cinvoke name="readFile"\u003e{"path":"foo.txt"}\u003c/invoke\u003e\u003c/function_calls\u003e`,
      "The file contains bar",
    ];
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "The file contains bar" });
    expect(caller.call).toHaveBeenCalledTimes(2);
  });

  it("returns final answer without tool calls", async () => {
    const caller = makeCaller(["I do not need tools."]);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "I do not need tools." });
    expect(caller.call).toHaveBeenCalledTimes(1);
  });

  it("executes oMLX native call:tool blocks", async () => {
    const responses = [
      `call:tool:readFile\n{"path":"foo.txt"}`,
      "The file contains bar",
    ];
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "The file contains bar" });
    expect(caller.call).toHaveBeenCalledTimes(2);
  });

  it("tolerates malformed XML tool blocks with mismatched tags", async () => {
    const responses = [
      `<tool name="readFile">\n{"path":"foo.txt"}\n</function>\n<tool>`,
      "The file contains bar",
    ];
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: "The file contains bar" });
    expect(caller.call).toHaveBeenCalledTimes(2);
  });

  it("fails when the final answer still contains unexecuted tool-like content", async () => {
    // The model never provides a clean final answer; it keeps emitting malformed tool blocks.
    const responses = Array.from({ length: 6 }, () =>
      `<tool name="readFile">\n{"path":"foo.txt"}\n</function>\n<tool>`,
    );
    const caller = makeCaller(responses);
    const agent = new TestAgent(caller, makeRegistry());
    const result = await agent.execute(makeSubTask());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tool-like block/);
    expect(caller.call).toHaveBeenCalledTimes(5);
  });
});
