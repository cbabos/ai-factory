import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SQLiteTagStore } from "../tag-store.js";

const tempDirs: string[] = [];

function createStore(): SQLiteTagStore {
  const dir = mkdtempSync(join(tmpdir(), "ai-factory-tag-store-"));
  tempDirs.push(dir);
  return new SQLiteTagStore(join(dir, "tags.db"));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SQLiteTagStore", () => {
  it("saves and lists active tags", () => {
    const store = createStore();
    const created = store.save({
      id: "mcp",
      label: "MCP",
      description: "Model Context Protocol work",
    });

    expect(created.id).toBe("mcp");
    expect(created.label).toBe("MCP");
    expect(store.getAllActive()).toHaveLength(1);
    store.close();
  });

  it("updates and soft deletes tags", () => {
    const store = createStore();
    store.save({
      id: "analysis",
      label: "Analysis",
    });

    const updated = store.update("analysis", {
      label: "Deep Analysis",
      description: "Used for investigation-heavy work",
    });
    expect(updated.label).toBe("Deep Analysis");
    expect(updated.description).toBe("Used for investigation-heavy work");

    store.softDelete("analysis");
    expect(store.getAllActive()).toHaveLength(0);
    expect(store.get("analysis")?.isActive).toBe(false);
    store.close();
  });

  it("migrates legacy config_history tables that only allow agent and model", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-factory-tag-store-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "legacy-tags.db");
    const legacyDb = new DatabaseSync(dbPath);

    legacyDb.exec(
      `CREATE TABLE config_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityType TEXT NOT NULL CHECK (entityType IN ('agent', 'model')),
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        oldData TEXT,
        newData TEXT,
        versionBefore INTEGER NOT NULL,
        versionAfter INTEGER NOT NULL,
        changedBy TEXT NOT NULL,
        changedAt INTEGER NOT NULL,
        description TEXT
      )`,
    );
    legacyDb.close();

    const store = new SQLiteTagStore(dbPath);
    const created = store.save({
      id: "mcp",
      label: "MCP",
    });

    expect(created.id).toBe("mcp");
    store.close();
  });
});
