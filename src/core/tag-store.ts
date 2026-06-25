import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface TagRecord {
  id: string;
  label: string;
  description?: string;
  version: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTagInput {
  id: string;
  label: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTagInput {
  label?: string;
  description?: string;
  isActive?: boolean;
}

export interface ITagStore {
  save(tag: CreateTagInput): TagRecord;
  get(id: string): TagRecord | undefined;
  getAll(): TagRecord[];
  getAllActive(): TagRecord[];
  update(id: string, updates: UpdateTagInput): TagRecord;
  delete(id: string): void;
  softDelete(id: string): void;
  close(): void;
}

export class SQLiteTagStore implements ITagStore {
  private readonly db: DatabaseSync;
  private readonly getStmt: StatementSync;
  private readonly getAllStmt: StatementSync;
  private readonly getAllActiveStmt: StatementSync;
  private readonly saveStmt: StatementSync;
  private readonly updateStmt: StatementSync;
  private readonly softDeleteStmt: StatementSync;
  private readonly historyStmt: StatementSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);

    this.db.exec(
      `CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )`,
    );
    this.ensureConfigHistoryTable();

    this.getStmt = this.db.prepare("SELECT * FROM tags WHERE id = ?");
    this.getAllStmt = this.db.prepare("SELECT * FROM tags ORDER BY isActive DESC, label COLLATE NOCASE ASC");
    this.getAllActiveStmt = this.db.prepare("SELECT * FROM tags WHERE isActive = 1 ORDER BY label COLLATE NOCASE ASC");
    this.saveStmt = this.db.prepare(
      `INSERT INTO tags (id, label, description, version, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         description = excluded.description,
         isActive = excluded.isActive,
         updatedAt = excluded.updatedAt,
         version = version + 1`,
    );
    this.updateStmt = this.db.prepare(
      `UPDATE tags SET
         label = ?,
         description = ?,
         isActive = ?,
         updatedAt = ?,
         version = version + 1
       WHERE id = ?`,
    );
    this.softDeleteStmt = this.db.prepare("UPDATE tags SET isActive = 0, updatedAt = ? WHERE id = ?");
    this.historyStmt = this.db.prepare(
      `INSERT INTO config_history (entityType, entityId, operation, oldData, newData, versionBefore, versionAfter, changedBy, changedAt, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  save(tag: CreateTagInput): TagRecord {
    const existing = this.get(tag.id);
    const now = Date.now();
    const isActive = tag.isActive ?? true;
    const description = tag.description ?? "";

    this.saveStmt.run(
      tag.id,
      tag.label,
      description,
      1,
      isActive ? 1 : 0,
      existing?.createdAt ?? now,
      now,
    );

    const record = this.get(tag.id);
    if (!record) {
      throw new Error(`Failed to save tag ${tag.id}`);
    }

    this.logHistory(
      tag.id,
      existing ? "update" : "create",
      existing ? JSON.stringify(existing) : null,
      JSON.stringify(record),
      existing?.version ?? 0,
      record.version,
      now,
    );

    return record;
  }

  get(id: string): TagRecord | undefined {
    const row = this.getStmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.createRecordFromRow(row);
  }

  getAll(): TagRecord[] {
    const rows = this.getAllStmt.all() as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  getAllActive(): TagRecord[] {
    const rows = this.getAllActiveStmt.all() as Record<string, unknown>[];
    return rows.map((row) => this.createRecordFromRow(row));
  }

  update(id: string, updates: UpdateTagInput): TagRecord {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Tag ${id} not found`);
    }

    const now = Date.now();
    const label = updates.label ?? existing.label;
    const description = updates.description ?? existing.description ?? "";
    const isActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;

    this.updateStmt.run(label, description, isActive ? 1 : 0, now, id);

    const updated = this.get(id);
    if (!updated) {
      throw new Error(`Failed to update tag ${id}`);
    }

    this.logHistory(
      id,
      "update",
      JSON.stringify(existing),
      JSON.stringify(updated),
      existing.version,
      updated.version,
      now,
    );

    return updated;
  }

  delete(id: string): void {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Tag ${id} not found`);
    }

    const now = Date.now();
    this.db.prepare("DELETE FROM tags WHERE id = ?").run(id);
    this.logHistory(id, "delete", JSON.stringify(existing), null, existing.version, 0, now);
  }

  softDelete(id: string): void {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Tag ${id} not found`);
    }

    const now = Date.now();
    this.softDeleteStmt.run(now, id);
    const updated = this.get(id);
    this.logHistory(
      id,
      "soft_delete",
      JSON.stringify(existing),
      updated ? JSON.stringify(updated) : null,
      existing.version,
      updated?.version ?? existing.version,
      now,
    );
  }

  close(): void {
    this.db.close();
  }

  private createRecordFromRow(row: Record<string, unknown>): TagRecord {
    return {
      id: row.id as string,
      label: row.label as string,
      description: (row.description as string | null) ?? undefined,
      version: row.version as number,
      isActive: row.isActive === 1,
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
    };
  }

  private ensureConfigHistoryTable(): void {
    const historyTable = this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'config_history'",
    ).get() as { sql?: string } | undefined;

    if (!historyTable?.sql) {
      this.createConfigHistoryTable();
      return;
    }

    if (historyTable.sql.includes("'tag'")) {
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

  private logHistory(
    entityId: string,
    operation: "create" | "update" | "delete" | "soft_delete",
    oldData: string | null,
    newData: string | null,
    versionBefore: number,
    versionAfter: number,
    changedAt: number,
  ): void {
    this.historyStmt.run(
      "tag",
      entityId,
      operation,
      oldData ?? "",
      newData ?? "",
      versionBefore,
      versionAfter,
      "system",
      changedAt,
      "",
    );
  }
}
