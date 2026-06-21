import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import type { ITool, ToolCall, ToolDefinition, ToolResult } from "./interfaces.js";

const MAX_BYTES = 64 * 1024;

abstract class FileTool implements ITool {
  abstract readonly definition: ToolDefinition;

  constructor(protected readonly basePath: string) {}

  protected resolvePath(relativeOrAbsolute: string): string {
    return isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : join(this.basePath, relativeOrAbsolute);
  }

  protected validatePath(args: Record<string, unknown>): { path: string; result?: ToolResult } {
    const raw = args.path;
    if (typeof raw !== "string" || raw.length === 0) {
      return {
        path: "",
        result: this.error("", "Missing or invalid 'path' argument"),
      };
    }
    return { path: this.resolvePath(raw) };
  }

  protected error(toolCallId: string, message: string): ToolResult {
    return {
      toolCallId,
      name: this.definition.name,
      output: null,
      success: false,
      error: message,
    };
  }

  abstract execute(call: ToolCall): Promise<ToolResult>;
}

export class ReadFileTool extends FileTool {
  readonly definition: ToolDefinition = {
    name: "readFile",
    description: "Read the contents of a text file up to 64 KiB.",
    parameters: [
      { name: "path", type: "string", description: "Absolute or relative file path", required: true },
    ],
  };

  execute(call: ToolCall): Promise<ToolResult> {
    const { path, result } = this.validatePath(call.arguments);
    if (result) return Promise.resolve(result);

    try {
      const stats = statSync(path);
      if (!stats.isFile()) {
        return Promise.resolve(this.error(call.id, `Not a file: ${path}`));
      }
      const content = readFileSync(path, "utf-8");
      const truncated = content.length > MAX_BYTES;
      return Promise.resolve({
        toolCallId: call.id,
        name: this.definition.name,
        output: { path, content: content.slice(0, MAX_BYTES), truncated },
        success: true,
      });
    } catch {
      return Promise.resolve(this.error(call.id, `Failed to read file: ${path}`));
    }
  }
}

export class WriteFileTool extends FileTool {
  readonly definition: ToolDefinition = {
    name: "writeFile",
    description: "Write text content to a file, creating directories as needed.",
    parameters: [
      { name: "path", type: "string", description: "Absolute or relative file path", required: true },
      { name: "content", type: "string", description: "Text content to write", required: true },
    ],
  };

  execute(call: ToolCall): Promise<ToolResult> {
    const { path, result } = this.validatePath(call.arguments);
    if (result) return Promise.resolve(result);

    const content = call.arguments.content;
    if (typeof content !== "string") {
      return Promise.resolve(this.error(call.id, "Missing or invalid 'content' argument"));
    }

    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf-8");
      return Promise.resolve({
        toolCallId: call.id,
        name: this.definition.name,
        output: { path, bytesWritten: Buffer.byteLength(content, "utf-8") },
        success: true,
      });
    } catch {
      return Promise.resolve(this.error(call.id, `Failed to write file: ${path}`));
    }
  }
}

export class ListDirectoryTool extends FileTool {
  readonly definition: ToolDefinition = {
    name: "listDirectory",
    description: "List files and directories inside a directory.",
    parameters: [
      { name: "path", type: "string", description: "Absolute or relative directory path", required: true },
    ],
  };

  execute(call: ToolCall): Promise<ToolResult> {
    const { path, result } = this.validatePath(call.arguments);
    if (result) return Promise.resolve(result);

    try {
      const stats = statSync(path);
      if (!stats.isDirectory()) {
        return Promise.resolve(this.error(call.id, `Not a directory: ${path}`));
      }
      const entries = readdirSync(path, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
      return Promise.resolve({
        toolCallId: call.id,
        name: this.definition.name,
        output: { path, entries },
        success: true,
      });
    } catch {
      return Promise.resolve(this.error(call.id, `Failed to list directory: ${path}`));
    }
  }
}

export function createFileTools(basePath: string = process.cwd()): ITool[] {
  return [
    new ReadFileTool(basePath),
    new WriteFileTool(basePath),
    new ListDirectoryTool(basePath),
  ];
}
