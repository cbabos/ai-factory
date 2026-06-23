
import type { Request, Response, NextFunction } from "express";
import type { Settings } from "../types.js";
import type { Theme } from "../api-types.js";
import { ApiError } from "../api-types.js";

// ─── Settings Store Interface ──────────────────────────────────────────────

export interface ISettingsStore {
  getSettings(): Settings | undefined;
  saveSettings(settings: Partial<Settings>): Settings;
}

export function setSettingsStore(app: import("express").Application, store: ISettingsStore): void {
  app.set("settingsStore", store);
}

export function getSettingsStore(req: Request): ISettingsStore | undefined {
  return req.app.get("settingsStore") as ISettingsStore | undefined;
}

// ─── Settings Handlers ─────────────────────────────────────────────────────

export async function getTheme(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getSettingsStore(req);
    
    if (!store) {
      res.json({ data: { theme: "synthwave84" } });
      return;
    }

    const settings = store.getSettings();
    
    res.json({ 
      data: { 
        theme: settings?.theme ?? "synthwave84",
        uiLayout: settings?.ui_layout,
      } 
    });
  } catch (error) {
    next(error);
  }
}

export async function setTheme(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getSettingsStore(req);
    
    if (!store) {
      throw new ApiError("Settings store not initialized", { 
        statusCode: 500, 
        code: "SETTINGS_STORE_NOT_FOUND" 
      });
    }

    const body = req.body as Record<string, unknown>;

    const existingTheme = body.theme as string;
    if (
      existingTheme &&
      !["synthwave84", "tokyonight", "zenburn"].includes(existingTheme)
    ) {
      throw new ApiError(
        "Invalid theme. Valid values: synthwave84, tokyonight, zenburn",
        { statusCode: 400, details: existingTheme },
      );
    }

    const settings = store.saveSettings({
      theme: (body.theme as Theme) ?? "synthwave84",
      ui_layout: (body.uiLayout as string) ?? "dashboard",
    });

    res.json({
      data: {
        id: settings.id,
        theme: settings.theme,
        uiLayout: settings.ui_layout,
        autoRefreshMs: settings.auto_refresh_ms,
        maxTasksDisplay: settings.max_tasks_display,
      },
    });
  } catch (error) {
    next(error);
  }
}
