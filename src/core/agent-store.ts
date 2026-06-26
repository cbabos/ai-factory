import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface AgentRecord {
  id: string;
  name: string;
  tags: string[];
  complexityMin: number;
  complexityMax: number;
  timeoutMs: number;
  maxRetries: number;
  version: number;
  isActive: boolean;
  configSource: "static" | "custom";
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentInput {
  id: string;
  name: string;
  tags: string[];
  complexityMin: number;
  complexityMax: number;
  timeoutMs?: number;
  maxRetries?: number;
  configSource?: "static" | "custom";
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  tags?: string[];
  complexityMin?: number;
  complexityMax?: number;
  timeoutMs?: number;
  maxRetries?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface IAgentStore {
  save(agent: CreateAgentInput): AgentRecord;
  get(id: string): AgentRecord | undefined;
  getAll(): AgentRecord[];
  update(id: string, updates: UpdateAgentInput): AgentRecord;
  delete(id: string): void;
  softDelete(id: string): void;
  findByTags(tags: string[]): AgentRecord[];
  close(): void;
}

export class SQLiteAgentStore implements IAgentStore {
  private readonly db: DatabaseSync;
  private readonly getStmt: StatementSync;
  private readonly getAllStmt: StatementSync;
  private readonly saveStmt: StatementSync;
  private readonly updateStmt: StatementSync;
  private readonly softDeleteStmt: StatementSync;
  private readonly historyStmt: StatementSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);

    this.db.exec(
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT NOT NULL,
        complexityMin INTEGER NOT NULL,
        complexityMax INTEGER NOT NULL,
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
    this.migrateLegacyAgentSchema();
    this.ensureConfigHistoryTable();

    this.db.exec(
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT NOT NULL,
        complexityMin INTEGER NOT NULL,
        complexityMax INTEGER NOT NULL,
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

    this.getStmt = this.db.prepare("SELECT * FROM agents WHERE id = ?");
    this.getAllStmt = this.db.prepare("SELECT * FROM agents ORDER BY updatedAt DESC");
    this.saveStmt = this.db.prepare(
      `INSERT INTO agents (
        id, name, tags, complexityMin, complexityMax, timeoutMs, maxRetries, version, isActive, configSource, description, metadata,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tags = excluded.tags,
        timeoutMs = excluded.timeoutMs,
        maxRetries = excluded.maxRetries,
        updatedAt = excluded.updatedAt,
        version = version + 1`,
    );
    this.updateStmt = this.db.prepare(
      `UPDATE agents SET
        name = ?,
        tags = ?,
        complexityMin = ?,
        complexityMax = ?,
        timeoutMs = ?,
        maxRetries = ?,
        description = ?,
        metadata = ?,
        isActive = ?,
        updatedAt = ?,
        version = version + 1
      WHERE id = ?`,
    );
    this.softDeleteStmt = this.db.prepare("UPDATE agents SET isActive = 0, updatedAt = ? WHERE id = ?");
    this.historyStmt = this.db.prepare(
      `INSERT INTO config_history (entityType, entityId, operation, oldData, newData, versionBefore, versionAfter, changedBy, changedAt, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  save(agent: CreateAgentInput): AgentRecord {
    const now = Date.now();
    const tagsJson = JSON.stringify(agent.tags);
    const metadataJson = agent.metadata ? JSON.stringify(agent.metadata) : JSON.stringify({});
    const description = agent.description ?? "";
    const configSource = agent.configSource ?? "static";

    this.saveStmt.run(
      agent.id,
      agent.name,
      tagsJson,
      agent.complexityMin,
      agent.complexityMax,
      agent.timeoutMs ?? 30000,
      agent.maxRetries ?? 2,
      1,
      1,
      configSource,
      description,
      metadataJson,
      now,
      now,
    );

    this.logHistory("agent", agent.id, "create", null, JSON.stringify(agent), 0, 1, "system", now);

    return this.createRecordFromRow({
      id: agent.id,
      name: agent.name,
      tags: tagsJson,
      complexityMin: agent.complexityMin,
      complexityMax: agent.complexityMax,
      timeoutMs: agent.timeoutMs ?? 30000,
      maxRetries: agent.maxRetries ?? 2,
      version: 1,
      isActive: 1,
      configSource: configSource,
      description: description,
      metadata: metadataJson,
      createdAt: now,
      updatedAt: now,
    });
  }

  get(id: string): AgentRecord | undefined {
    const row = this.getStmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.createRecordFromRow(row);
  }

  getAll(): AgentRecord[] {
    const rows = this.getAllStmt.all() as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  update(id: string, updates: UpdateAgentInput): AgentRecord {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Agent ${id} not found`);
    }

    const now = Date.now();
    const tagsJson = JSON.stringify(updates.tags ?? existing.tags);
    const metadataJson = JSON.stringify(updates.metadata ?? existing.metadata ?? {});

    this.updateStmt.run(
      updates.name ?? existing.name,
      tagsJson,
      updates.complexityMin ?? existing.complexityMin,
      updates.complexityMax ?? existing.complexityMax,
      updates.timeoutMs ?? existing.timeoutMs,
      updates.maxRetries ?? existing.maxRetries,
      (updates.description ?? existing.description) ?? "",
      metadataJson,
      updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (existing.isActive ? 1 : 0),
      now,
      id,
    );

    const oldData = JSON.stringify(existing);
    const updated: AgentRecord = {
      ...existing,
      ...updates,
      tags: updates.tags ?? existing.tags,
      metadata: updates.metadata ?? existing.metadata,
      updatedAt: now,
      version: existing.version + 1,
    };
    const newData = JSON.stringify(updated);

    this.logHistory("agent", id, "update", oldData, newData, existing.version, existing.version + 1, "system", now);

    return updated;
  }

  delete(id: string): void {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Agent ${id} not found`);
    }

    const now = Date.now();
    this.db.prepare("DELETE FROM agents WHERE id = ?").run(id);
    this.logHistory("agent", id, "delete", JSON.stringify(existing), null, existing.version, 0, "system", now);
  }

  softDelete(id: string): void {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Agent ${id} not found`);
    }

    const now = Date.now();
    this.softDeleteStmt.run(now, id);
    this.logHistory("agent", id, "soft_delete", JSON.stringify(existing), null, existing.version, existing.version, "system", now);
  }

  findByTags(tags: string[]): AgentRecord[] {
    const sql = `SELECT * FROM agents WHERE isActive = 1 AND tags LIKE ?`;
    const rows = this.db.prepare(sql).all(`%${tags[0]}%`) as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row)).filter((agent) => {
      const agentTags = new Set(agent.tags);
      return tags.every((tag) => agentTags.has(tag));
    });
  }

  close(): void {
    this.db.close();
  }

  private ensureConfigHistoryTable(): void {
    const historyTable = this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'config_history'",
    ).get() as { sql?: string } | undefined;

    if (!historyTable?.sql) {
      this.createConfigHistoryTable();
      return;
    }

    if (historyTable.sql.includes("'agent'")) {
      return;
    }

    this.db.exec("ALTER TABLE config_history RENAME TO config_history_legacy");
    this.createConfigHistoryTable();
    this.db.exec(
      `INSERT INTO config_history (
        id, entityType, entityId, operation, oldData, newData, versionBefore,
        versionAfter, changedBy, changedAt, description
      )
      SELECT
        id, entityType, entityId, operation, oldData, newData, versionBefore,
        versionAfter, changedBy, changedAt, description
      FROM config_history_legacy`,
    );
    this.db.exec("DROP TABLE config_history_legacy");
  }

  private createConfigHistoryTable(): void {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS config_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entityType TEXT NOT NULL CHECK (entityType IN ('agent', 'model', 'tag')),
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
  }

  private migrateLegacyAgentSchema(): void {
    const columns = this.db.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string }>;
    if (columns.length === 0) {
      return;
    }

    const columnNames = new Set(columns.map((column) => column.name));
    const hasLegacyColumns = columnNames.has("tokenProfileMin")
      || columnNames.has("tokenProfileMax")
      || columnNames.has("tokenProfileTypical")
      || columnNames.has("preferredModels");

    if (!hasLegacyColumns) {
      return;
    }

    const dependentViews = this.db.prepare(
      `SELECT name, sql
       FROM sqlite_master
       WHERE type = 'view'
         AND sql IS NOT NULL
         AND sql LIKE '%agents%'`,
    ).all() as Array<{ name: string; sql: string }>;

    for (const view of dependentViews) {
      this.db.exec(`DROP VIEW IF EXISTS "${view.name}"`);
    }

    this.db.exec(
      `CREATE TABLE agents_migrated (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT NOT NULL,
        complexityMin INTEGER NOT NULL,
        complexityMax INTEGER NOT NULL,
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
    this.db.exec(
      `INSERT INTO agents_migrated (
        id, name, tags, complexityMin, complexityMax, timeoutMs, maxRetries, version, isActive,
        configSource, description, metadata, createdAt, updatedAt
      )
      SELECT
        id, name, tags, complexityMin, complexityMax, timeoutMs, maxRetries, version, isActive,
        configSource, description, metadata, createdAt, updatedAt
      FROM agents`,
    );
    this.db.exec("DROP TABLE agents");
    this.db.exec("ALTER TABLE agents_migrated RENAME TO agents");

    for (const view of dependentViews) {
      this.db.exec(view.sql);
    }
  }

  private createRecordFromRow(row: Record<string, unknown>): AgentRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      tags: JSON.parse(row.tags as string) as string[],
      complexityMin: row.complexityMin as number,
      complexityMax: row.complexityMax as number,
      timeoutMs: row.timeoutMs as number,
      maxRetries: row.maxRetries as number,
      version: row.version as number,
      isActive: row.isActive === 1,
      configSource: row.configSource as "static" | "custom",
      description: row.description as string | undefined,
      metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : {},
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
    };
  }

  private logHistory(
    entityType: "agent" | "model",
    entityId: string,
    operation: "create" | "update" | "delete" | "soft_delete",
    oldData: string | null,
    newData: string | null,
    versionBefore: number,
    versionAfter: number,
    changedBy: string,
    changedAt: number,
  ): void {
    this.historyStmt.run(
      entityType,
      entityId,
      operation,
      oldData ?? "",
      newData ?? "",
      versionBefore,
      versionAfter,
      changedBy,
      changedAt,
    );
  }
}
