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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );

    this.getStmt = this.db.prepare("SELECT * FROM settings WHERE id = ?");
    this.saveStmt = this.db.prepare(
      `INSERT INTO settings (id, theme, ui_layout, auto_refresh_ms, max_tasks_display, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         theme = excluded.theme,
         ui_layout = excluded.ui_layout,
         auto_refresh_ms = excluded.auto_refresh_ms,
         max_tasks_display = excluded.max_tasks_display,
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
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
