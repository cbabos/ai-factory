import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunShellCommandTool } from "../shell-tool.js";

describe("RunShellCommandTool", () => {
  it("runs a safe read-only command", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "1", name: "runShellCommand", arguments: { command: ["echo", "hello"] } });
    expect(result.success).toBe(true);
    expect((result.output as { stdout: string }).stdout.trim()).toBe("hello");
  });

  it("runs a command in the provided cwd", async () => {
    const tool = new RunShellCommandTool();
    const cwd = mkdtempSync(join(tmpdir(), "shell-tool-"));
    try {
      const result = await tool.execute({
        id: "cwd",
        name: "runShellCommand",
        arguments: {
          command: ["pwd"],
          cwd,
        },
      });
      expect(result.success).toBe(true);
      expect(realpathSync((result.output as { stdout: string }).stdout.trim())).toBe(realpathSync(cwd));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("blocks dangerous commands", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "2", name: "runShellCommand", arguments: { command: ["rm", "-rf", "/"] } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Blocked");
  });

  it("rejects shell chaining tokens and suggests cwd", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({
      id: "chain",
      name: "runShellCommand",
      arguments: {
        command: ["cd", "/tmp", "&&", "pwd"],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("cwd");
  });

  it("rejects invalid command argument", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "3", name: "runShellCommand", arguments: { command: "date" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid command");
  });

  it("rejects invalid cwd argument", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({
      id: "bad-cwd",
      name: "runShellCommand",
      arguments: {
        command: ["pwd"],
        cwd: ["not-a-string"],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid cwd");
  });
});
