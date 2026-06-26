import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SQLiteAgentStore } from "../agent-store.js";

const tempDirs: string[] = [];

function createStore(dbName = "agents.db"): SQLiteAgentStore {
  const dir = mkdtempSync(join(tmpdir(), "ai-factory-agent-store-"));
  tempDirs.push(dir);
  return new SQLiteAgentStore(join(dir, dbName));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SQLiteAgentStore", () => {
  it("saves and updates agents with the streamlined contract", () => {
    const store = createStore();

    const created = store.save({
      id: "analysis-agent",
      name: "Analysis Agent",
      tags: ["analysis"],
      complexityMin: 2,
      complexityMax: 7,
      timeoutMs: 60000,
      maxRetries: 3,
      configSource: "custom",
      description: "Investigates requests",
      metadata: { systemPrompt: "Analyze carefully." },
    });

    expect(created.id).toBe("analysis-agent");
    expect(created.timeoutMs).toBe(60000);
    expect(created.maxRetries).toBe(3);
    expect(store.getAll()).toHaveLength(1);

    const updated = store.update("analysis-agent", {
      timeoutMs: 90000,
      maxRetries: 4,
      tags: ["analysis", "reasoning"],
    });

    expect(updated.timeoutMs).toBe(90000);
    expect(updated.maxRetries).toBe(4);
    expect(updated.tags).toEqual(["analysis", "reasoning"]);
    store.close();
  });

  it("migrates legacy agent tables that still include token profile columns", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-factory-agent-store-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "legacy-agents.db");
    const legacyDb = new DatabaseSync(dbPath);

    legacyDb.exec(
      `CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT NOT NULL,
        complexityMin INTEGER NOT NULL,
        complexityMax INTEGER NOT NULL,
        tokenProfileMin INTEGER NOT NULL,
        tokenProfileMax INTEGER NOT NULL,
        tokenProfileTypical INTEGER NOT NULL,
        preferredModels TEXT,
        timeoutMs INTEGER NOT NULL DEFAULT 30000,
        maxRetries INTEGER NOT NULL DEFAULT 2,
        version INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        configSource TEXT DEFAULT 'static',
        description TEXT,
        metadata TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(name)
      )`,
    );
    legacyDb.exec(`
      INSERT INTO agents (
        id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical,
        preferredModels, timeoutMs, maxRetries, version, isActive, configSource, description, metadata, createdAt, updatedAt
      ) VALUES (
        'legacy-agent', 'Legacy Agent', '["analysis"]', 1, 5, 100, 500, 250,
        '["gpt-4o-mini"]', 45000, 2, 3, 1, 'custom', 'Old shape', '{"notes":"keep me"}', 1, 2
      )
    `);
    legacyDb.close();

    const store = new SQLiteAgentStore(dbPath);
    const migrated = store.get("legacy-agent");

    expect(migrated?.id).toBe("legacy-agent");
    expect(migrated?.timeoutMs).toBe(45000);
    expect(migrated?.metadata).toEqual({ notes: "keep me" });

    const verifyDb = new DatabaseSync(dbPath);
    const columns = verifyDb.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "tokenProfileMin")).toBe(false);
    expect(columns.some((column) => column.name === "preferredModels")).toBe(false);
    verifyDb.close();

    store.close();
  });

  it("migrates legacy agent tables even when dependent views exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-factory-agent-store-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "legacy-agents-with-view.db");
    const legacyDb = new DatabaseSync(dbPath);

    legacyDb.exec(
      `CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT NOT NULL,
        complexityMin INTEGER NOT NULL,
        complexityMax INTEGER NOT NULL,
        tokenProfileMin INTEGER NOT NULL,
        tokenProfileMax INTEGER NOT NULL,
        tokenProfileTypical INTEGER NOT NULL,
        preferredModels TEXT,
        timeoutMs INTEGER NOT NULL DEFAULT 30000,
        maxRetries INTEGER NOT NULL DEFAULT 2,
        version INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        configSource TEXT DEFAULT 'static',
        description TEXT,
        metadata TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(name)
      )`,
    );
    legacyDb.exec(
      `CREATE VIEW v_active_agents AS
       SELECT id, name
       FROM agents
       WHERE isActive = 1`,
    );
    legacyDb.exec(`
      INSERT INTO agents (
        id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical,
        preferredModels, timeoutMs, maxRetries, version, isActive, configSource, description, metadata, createdAt, updatedAt
      ) VALUES (
        'legacy-agent', 'Legacy Agent', '["analysis"]', 1, 5, 100, 500, 250,
        '["gpt-4o-mini"]', 45000, 2, 3, 1, 'custom', 'Old shape', '{"notes":"keep me"}', 1, 2
      )
    `);
    legacyDb.close();

    const store = new SQLiteAgentStore(dbPath);
    expect(store.get("legacy-agent")?.id).toBe("legacy-agent");

    const verifyDb = new DatabaseSync(dbPath);
    const view = verifyDb.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'v_active_agents'",
    ).get() as { sql?: string } | undefined;
    expect(view?.sql).toContain("FROM agents");
    const activeRows = verifyDb.prepare("SELECT * FROM v_active_agents").all() as Array<{ id: string }>;
    expect(activeRows.map((row) => row.id)).toEqual(["legacy-agent"]);
    verifyDb.close();

    store.close();
  });
});
