export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required?: boolean;
  items?: { type: "string" | "number" | "boolean" };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: unknown;
  success: boolean;
  error?: string;
}

export interface ITool {
  readonly definition: ToolDefinition;
  execute(call: ToolCall): Promise<ToolResult>;
}

export interface IToolRegistry {
  register(tool: ITool): void;
  get(name: string): ITool | undefined;
  list(): ToolDefinition[];
  execute(call: ToolCall): Promise<ToolResult>;
}
