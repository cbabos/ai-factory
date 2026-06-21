import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReadFileTool, WriteFileTool, ListDirectoryTool, createFileTools } from "../file-tools.js";
import { ToolRegistry } from "../tool-registry.js";

describe("File tools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ai-tools-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readFile returns file content", async () => {
    const filePath = join(tmpDir, "a.txt");
    writeFileSync(filePath, "hello", "utf-8");
    const tool = new ReadFileTool(tmpDir);
    const result = await tool.execute({ id: "1", name: "readFile", arguments: { path: "a.txt" } });
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ path: filePath, content: "hello", truncated: false });
  });

  it("writeFile creates a file", async () => {
    const tool = new WriteFileTool(tmpDir);
    const result = await tool.execute({ id: "2", name: "writeFile", arguments: { path: "b.txt", content: "world" } });
    expect(result.success).toBe(true);
    expect((result.output as { bytesWritten: number }).bytesWritten).toBe(5);
    expect(tool["basePath"]).toBe(tmpDir);
  });

  it("listDirectory lists entries", async () => {
    writeFileSync(join(tmpDir, "x.txt"), "x", "utf-8");
    mkdirSync(join(tmpDir, "sub"));
    const tool = new ListDirectoryTool(tmpDir);
    const result = await tool.execute({ id: "3", name: "listDirectory", arguments: { path: "." } });
    expect(result.success).toBe(true);
    const entries = (result.output as { entries: { name: string }[] }).entries;
    expect(entries.some((e) => e.name === "x.txt")).toBe(true);
    expect(entries.some((e) => e.name === "sub")).toBe(true);
  });

  it("registry executes a registered tool", async () => {
    const registry = new ToolRegistry();
    for (const tool of createFileTools(tmpDir)) {
      registry.register(tool);
    }
    const result = await registry.execute({ id: "4", name: "readFile", arguments: { path: "missing.txt" } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to read file");
  });
});
