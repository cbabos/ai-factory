import { execFileSync } from "node:child_process";
import type { ITool, ToolCall, ToolDefinition, ToolResult } from "./interfaces.js";

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/etc\/passwd/,
  />\s*\/etc\/shadow/,
  /mkfs\./,
  /:\(\)\{\s*:\|:\s*\u0026\s*\};/, // fork bomb
  /curl\s+.*\s*\|\s*sh/,
  /wget\s+.*\s*\|\s*sh/,
];

const SHELL_OPERATOR_TOKENS = new Set(["&&", "||", "|", ";"]);

export class RunShellCommandTool implements ITool {
  readonly definition: ToolDefinition = {
    name: "runShellCommand",
    description: "Run a read-only command and return stdout/stderr. Destructive commands are blocked. Use cwd instead of shell chaining like cd/&&.",
    parameters: [
      { name: "command", type: "array", description: "Command and arguments as an array", required: true },
      { name: "cwd", type: "string", description: "Optional working directory for the command" },
    ],
  };

  execute(call: ToolCall): Promise<ToolResult> {
    const args = call.arguments;
    const command = args.command;
    const cwd = args.cwd;
    if (!Array.isArray(command) || command.length === 0 || !command.every((c) => typeof c === "string")) {
      return Promise.resolve({
        toolCallId: call.id,
        name: call.name,
        output: null,
        success: false,
        error: "Invalid command: expected non-empty string array",
      });
    }
    if (cwd !== undefined && typeof cwd !== "string") {
      return Promise.resolve({
        toolCallId: call.id,
        name: call.name,
        output: null,
        success: false,
        error: "Invalid cwd: expected string",
      });
    }

    const typedCommand = command as string[];
    const typedCwd = typeof cwd === "string" && cwd.trim().length > 0 ? cwd : undefined;
    const commandText = typedCommand.join(" ");
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(commandText)) {
        return Promise.resolve({
          toolCallId: call.id,
          name: call.name,
          output: null,
          success: false,
          error: `Blocked command: ${commandText}`,
        });
      }
    }
    for (const token of typedCommand) {
      if (SHELL_OPERATOR_TOKENS.has(token)) {
        return Promise.resolve({
          toolCallId: call.id,
          name: call.name,
          output: null,
          success: false,
          error: `Shell operators are not supported in command arrays. Use separate arguments and pass cwd instead of shell chaining: ${token}`,
        });
      }
    }

    const file = typedCommand[0];
    const fileArgs = typedCommand.slice(1);
    if (typeof file !== "string" || fileArgs.some((a) => typeof a !== "string")) {
      return Promise.resolve({
        toolCallId: call.id,
        name: call.name,
        output: null,
        success: false,
        error: "Invalid command: expected non-empty string array",
      });
    }

    try {
      const stdout = execFileSync(file, fileArgs, {
        encoding: "utf-8",
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        cwd: typedCwd,
      });
      return Promise.resolve({
        toolCallId: call.id,
        name: call.name,
        output: { command: typedCommand, cwd: typedCwd, stdout },
        success: true,
      });
    } catch (err) {
      return Promise.resolve({
        toolCallId: call.id,
        name: call.name,
        output: null,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
