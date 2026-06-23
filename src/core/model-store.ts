import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface ModelRecord {
  id: string;
  provider: string;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: string[];
  ownedBy?: string;
  version: number;
  isActive: boolean;
  discoveredAt?: number;
  configSource: "static" | "discovered";
  createdAt: number;
  updatedAt: number;
}

export interface CreateModelInput {
  provider: string;
  modelId: string;
  maxTokens?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  capabilities?: string[];
  ownedBy?: string;
  configSource?: "static" | "discovered";
  discoveredAt?: number;
}

export interface UpdateModelInput {
  provider: string;
  modelId: string;
  maxTokens?: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  capabilities?: string[];
  ownedBy?: string;
  isActive?: boolean;
}

export interface IModelStore {
  save(model: CreateModelInput): ModelRecord;
  get(provider: string, modelId: string): ModelRecord | undefined;
  getAll(): ModelRecord[];
  getAllActive(): ModelRecord[];
  getMany(ids: string[]): ModelRecord[];
  update(provider: string, modelId: string, updates: UpdateModelInput): ModelRecord;
  delete(provider: string, modelId: string): void;
  softDelete(provider: string, modelId: string): void;
  findByCapability(capability: string): ModelRecord[];
  close(): void;
}

export class SQLiteModelStore implements IModelStore {
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
      `CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        modelId TEXT NOT NULL,
        maxTokens INTEGER NOT NULL DEFAULT 4096,
        costPer1kInput REAL NOT NULL DEFAULT 0.001,
        costPer1kOutput REAL NOT NULL DEFAULT 0.001,
        capabilities TEXT NOT NULL DEFAULT '[]',
        ownedBy TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        discoveredAt INTEGER,
        configSource TEXT DEFAULT 'static',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(provider, modelId)
      )`,
    );

    this.getStmt = this.db.prepare("SELECT * FROM models WHERE id = ?");
    this.getAllStmt = this.db.prepare("SELECT * FROM models ORDER BY updatedAt DESC");
    this.saveStmt = this.db.prepare(
      `INSERT INTO models (
        id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy,
        version, isActive, discoveredAt, configSource, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        maxTokens = excluded.maxTokens,
        costPer1kInput = excluded.costPer1kInput,
        costPer1kOutput = excluded.costPer1kOutput,
        capabilities = excluded.capabilities,
        updatedAt = excluded.updatedAt,
        version = version + 1`,
    );
    this.updateStmt = this.db.prepare(
      `UPDATE models SET
        maxTokens = ?,
        costPer1kInput = ?,
        costPer1kOutput = ?,
        capabilities = ?,
        ownedBy = ?,
        isActive = ?,
        updatedAt = ?,
        version = version + 1
      WHERE id = ?`,
    );
    this.softDeleteStmt = this.db.prepare("UPDATE models SET isActive = 0, updatedAt = ? WHERE id = ?");
    this.historyStmt = this.db.prepare(
      `INSERT INTO config_history (entityType, entityId, operation, oldData, newData, versionBefore, versionAfter, changedBy, changedAt, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  save(model: CreateModelInput): ModelRecord {
    const now = Date.now();
    const id = `${model.provider}:${model.modelId}`;
    const capabilitiesJson = JSON.stringify(model.capabilities ?? []);
    const ownedBy = model.ownedBy ?? "";
    const discoveredAt = model.discoveredAt ?? 0;
    const configSource = model.configSource ?? "static";

    this.saveStmt.run(
      id,
      model.provider,
      model.modelId,
      model.maxTokens ?? 4096,
      model.costPer1kInput ?? 0.001,
      model.costPer1kOutput ?? 0.001,
      capabilitiesJson,
      ownedBy,
      1,
      1,
      discoveredAt,
      configSource,
      now,
      now,
    );

    this.logHistory("model", id, "create", null, JSON.stringify(model), 0, 1, "system", now);

    return this.createRecordFromRow({
      id,
      provider: model.provider,
      modelId: model.modelId,
      maxTokens: model.maxTokens ?? 4096,
      costPer1kInput: model.costPer1kInput ?? 0.001,
      costPer1kOutput: model.costPer1kOutput ?? 0.001,
      capabilities: capabilitiesJson,
      ownedBy: ownedBy,
      version: 1,
      isActive: 1,
      discoveredAt,
      configSource,
      createdAt: now,
      updatedAt: now,
    });
  }

  get(provider: string, modelId: string): ModelRecord | undefined {
    const id = `${provider}:${modelId}`;
    const row = this.getStmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.createRecordFromRow(row);
  }

  getAll(): ModelRecord[] {
    const rows = this.getAllStmt.all() as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  getAllActive(): ModelRecord[] {
    const sql = "SELECT * FROM models WHERE isActive = 1 ORDER BY updatedAt DESC";
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  getMany(ids: string[]): ModelRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const sql = `SELECT * FROM models WHERE id IN (${placeholders}) ORDER BY updatedAt DESC`;
    const rows = this.db.prepare(sql).all(...ids) as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  update(provider: string, modelId: string, updates: UpdateModelInput): ModelRecord {
    const id = `${provider}:${modelId}`;
    const existing = this.get(provider, modelId);
    if (!existing) {
      throw new Error(`Model ${id} not found`);
    }

    const now = Date.now();
    const capabilitiesJson = updates.capabilities ? JSON.stringify(updates.capabilities) : JSON.stringify(existing.capabilities);
    const ownedBy = updates.ownedBy ?? existing.ownedBy ?? "";
    const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (existing.isActive ? 1 : 0);

    this.updateStmt.run(
      updates.maxTokens ?? existing.maxTokens,
      updates.costPer1kInput ?? existing.costPer1kInput,
      updates.costPer1kOutput ?? existing.costPer1kOutput,
      capabilitiesJson,
      ownedBy,
      isActive,
      now,
      id,
    );

    const oldData = JSON.stringify(existing);
    const updated: ModelRecord = {
      ...existing,
      maxTokens: updates.maxTokens ?? existing.maxTokens,
      costPer1kInput: updates.costPer1kInput ?? existing.costPer1kInput,
      costPer1kOutput: updates.costPer1kOutput ?? existing.costPer1kOutput,
      capabilities: updates.capabilities ?? existing.capabilities,
      ownedBy: updates.ownedBy ?? existing.ownedBy,
      isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
      updatedAt: now,
      version: existing.version + 1,
    };
    const newData = JSON.stringify(updated);

    this.logHistory("model", id, "update", oldData, newData, existing.version, existing.version + 1, "system", now);

    return updated;
  }

  delete(provider: string, modelId: string): void {
    const id = `${provider}:${modelId}`;
    const existing = this.get(provider, modelId);
    if (!existing) {
      throw new Error(`Model ${id} not found`);
    }

    const now = Date.now();
    this.db.prepare("DELETE FROM models WHERE id = ?").run(id);
    this.logHistory("model", id, "delete", JSON.stringify(existing), null, existing.version, 0, "system", now);
  }

  softDelete(provider: string, modelId: string): void {
    const id = `${provider}:${modelId}`;
    const existing = this.get(provider, modelId);
    if (!existing) {
      throw new Error(`Model ${id} not found`);
    }

    const now = Date.now();
    this.softDeleteStmt.run(now, id);
    this.logHistory("model", id, "soft_delete", JSON.stringify(existing), null, existing.version, existing.version, "system", now);
  }

  findByCapability(capability: string): ModelRecord[] {
    const sql = `SELECT * FROM models WHERE isActive = 1 AND capabilities LIKE ?`;
    const rows = this.db.prepare(sql).all(`%${capability}%`) as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row)).filter((model) => {
      const modelCapabilities = new Set(model.capabilities);
      return modelCapabilities.has(capability);
    });
  }

  close(): void {
    this.db.close();
  }

  private createRecordFromRow(row: Record<string, unknown>): ModelRecord {
    return {
      id: row.id as string,
      provider: row.provider as string,
      modelId: row.modelId as string,
      maxTokens: row.maxTokens as number,
      costPer1kInput: row.costPer1kInput as number,
      costPer1kOutput: row.costPer1kOutput as number,
      capabilities: JSON.parse(row.capabilities as string) as string[],
      ownedBy: row.ownedBy as string | undefined,
      version: row.version as number,
      isActive: row.isActive === 1,
      discoveredAt: row.discoveredAt as number | undefined,
      configSource: row.configSource as "static" | "discovered",
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
