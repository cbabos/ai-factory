import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { IRepository } from "./interfaces.js";

export class SQLiteRepository<T extends { id: string }> implements IRepository<T> {
  private readonly db: DatabaseSync;
  private readonly getStmt: StatementSync;
  private readonly getAllStmt: StatementSync;
  private readonly saveStmt: StatementSync;
  private readonly deleteStmt: StatementSync;

  constructor(path: string, tableName: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
    );

    this.getStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE id = ?`,
    );
    this.getAllStmt = this.db.prepare(`SELECT data FROM ${tableName}`);
    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    );
    this.deleteStmt = this.db.prepare(
      `DELETE FROM ${tableName} WHERE id = ?`,
    );
  }

  async get(id: string): Promise<T | undefined> {
    const row = this.getStmt.get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  async getAll(): Promise<T[]> {
    const rows = this.getAllStmt.all() as { data: string }[];
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  async save(item: T): Promise<void> {
    const data = JSON.stringify(item);
    this.saveStmt.run(item.id, data);
  }

  async delete(id: string): Promise<void> {
    this.deleteStmt.run(id);
  }

  async query(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAll();
    return all.filter(predicate);
  }

  close(): void {
    this.db.close();
  }
}
