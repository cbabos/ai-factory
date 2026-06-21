import type { ITool, IToolRegistry, ToolCall, ToolDefinition, ToolResult } from "./interfaces.js";

export class ToolRegistry implements IToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        output: null,
        success: false,
        error: `Unknown tool: ${call.name}`,
      };
    }
    return tool.execute(call);
  }
}
