import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { Settings, UpdateSettingsInput } from "./types.js";

export interface IConfigStore {
  getSettings(): Settings | undefined;
  saveSettings(settings: UpdateSettingsInput): Settings;
  updateSettings(updates: Partial<UpdateSettingsInput>): Settings;
  deleteSettings(): void;
}

export class SQLiteConfigStore implements IConfigStore {
  private readonly db: DatabaseSync;
  private readonly getStmt: StatementSync;
  private readonly saveStmt: StatementSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY CHECK (id = 'app_settings'),
        theme TEXT NOT NULL CHECK (theme IN ('synthwave84', 'tokyonight', 'zenburn')),
        ui_layout TEXT DEFAULT 'dashboard',
        auto_refresh_ms INTEGER DEFAULT 5000,
        max_tasks_display INTEGER DEFAULT 100,
        decomposition_threshold INTEGER DEFAULT 5,
        budget_default_cap REAL DEFAULT 10,
        budget_soft_cap_ratio REAL DEFAULT 0.8,
        dispatch_max_concurrency INTEGER DEFAULT 5,
        dispatch_default_timeout_ms INTEGER DEFAULT 120000,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
    this.ensureColumn("decomposition_threshold", "INTEGER DEFAULT 5");
    this.ensureColumn("budget_default_cap", "REAL DEFAULT 10");
    this.ensureColumn("budget_soft_cap_ratio", "REAL DEFAULT 0.8");
    this.ensureColumn("dispatch_max_concurrency", "INTEGER DEFAULT 5");
    this.ensureColumn("dispatch_default_timeout_ms", "INTEGER DEFAULT 120000");

    this.getStmt = this.db.prepare("SELECT * FROM settings WHERE id = ?");
    this.saveStmt = this.db.prepare(
      `INSERT INTO settings (
         id, theme, ui_layout, auto_refresh_ms, max_tasks_display,
         decomposition_threshold, budget_default_cap, budget_soft_cap_ratio,
         dispatch_max_concurrency, dispatch_default_timeout_ms, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         theme = excluded.theme,
         ui_layout = excluded.ui_layout,
         auto_refresh_ms = excluded.auto_refresh_ms,
         max_tasks_display = excluded.max_tasks_display,
         decomposition_threshold = excluded.decomposition_threshold,
         budget_default_cap = excluded.budget_default_cap,
         budget_soft_cap_ratio = excluded.budget_soft_cap_ratio,
         dispatch_max_concurrency = excluded.dispatch_max_concurrency,
         dispatch_default_timeout_ms = excluded.dispatch_default_timeout_ms,
         updated_at = excluded.updated_at`,
    );
  }

  getSettings(): Settings | undefined {
    const row = this.getStmt.get("app_settings") as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToSettings(row);
  }

  saveSettings(settings: UpdateSettingsInput): Settings {
    const now = Date.now();
    const existing = this.getSettings();
    this.saveStmt.run(
      "app_settings",
      settings.theme,
      settings.ui_layout ?? "dashboard",
      settings.auto_refresh_ms ?? 5000,
      settings.max_tasks_display ?? 100,
      settings.decomposition_threshold ?? 5,
      settings.budget_default_cap ?? 10,
      settings.budget_soft_cap_ratio ?? 0.8,
      settings.dispatch_max_concurrency ?? 5,
      settings.dispatch_default_timeout_ms ?? 120000,
      existing?.createdAt ?? now,
      now,
    );
    return {
      id: "app_settings",
      ...settings,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  updateSettings(updates: Partial<UpdateSettingsInput>): Settings {
    const existing = this.getSettings() ?? {
      theme: "synthwave84",
      ui_layout: "dashboard",
      auto_refresh_ms: 5000,
      max_tasks_display: 100,
      decomposition_threshold: 5,
      budget_default_cap: 10,
      budget_soft_cap_ratio: 0.8,
      dispatch_max_concurrency: 5,
      dispatch_default_timeout_ms: 120000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated: Settings = {
      id: "app_settings",
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    this.saveStmt.run(
      "app_settings",
      updated.theme,
      updated.ui_layout,
      updated.auto_refresh_ms,
      updated.max_tasks_display,
      updated.decomposition_threshold,
      updated.budget_default_cap,
      updated.budget_soft_cap_ratio,
      updated.dispatch_max_concurrency,
      updated.dispatch_default_timeout_ms,
      existing.createdAt,
      updated.updatedAt,
    );
    return updated;
  }

  deleteSettings(): void {
    this.db.prepare("DELETE FROM settings WHERE id = ?").run("app_settings");
  }

  close(): void {
    this.db.close();
  }

  private rowToSettings(row: Record<string, unknown>): Settings {
    return {
      id: row.id as string,
      theme: row.theme as "synthwave84" | "tokyonight" | "zenburn",
      ui_layout: row.ui_layout as string,
      auto_refresh_ms: row.auto_refresh_ms as number,
      max_tasks_display: row.max_tasks_display as number,
      decomposition_threshold: row.decomposition_threshold as number,
      budget_default_cap: row.budget_default_cap as number,
      budget_soft_cap_ratio: row.budget_soft_cap_ratio as number,
      dispatch_max_concurrency: row.dispatch_max_concurrency as number,
      dispatch_default_timeout_ms: row.dispatch_default_timeout_ms as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private ensureColumn(name: string, definition: string): void {
    const columns = this.db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === name)) {
      return;
    }
    this.db.exec(`ALTER TABLE settings ADD COLUMN ${name} ${definition}`);
  }
}
