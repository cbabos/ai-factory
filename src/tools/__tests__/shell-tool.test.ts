import { describe, it, expect } from "vitest";
import { RunShellCommandTool } from "../shell-tool.js";

describe("RunShellCommandTool", () => {
  it("runs a safe read-only command", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "1", name: "runShellCommand", arguments: { command: ["echo", "hello"] } });
    expect(result.success).toBe(true);
    expect((result.output as { stdout: string }).stdout.trim()).toBe("hello");
  });

  it("blocks dangerous commands", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "2", name: "runShellCommand", arguments: { command: ["rm", "-rf", "/"] } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Blocked");
  });

  it("rejects invalid command argument", async () => {
    const tool = new RunShellCommandTool();
    const result = await tool.execute({ id: "3", name: "runShellCommand", arguments: { command: "date" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid command");
  });
});
