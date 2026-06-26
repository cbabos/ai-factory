
import type { Request, Response, NextFunction } from "express";
import type { Settings } from "../types.js";
import type { Theme } from "../api-types.js";
import { ApiError } from "../api-types.js";

// ─── Settings Store Interface ──────────────────────────────────────────────

export interface ISettingsStore {
  getSettings(): Settings | undefined;
  saveSettings(settings: Partial<Settings>): Settings;
  updateSettings(updates: Partial<Settings>): Settings;
}

export function setSettingsStore(app: import("express").Application, store: ISettingsStore): void {
  app.set("settingsStore", store);
}

export function getSettingsStore(req: Request): ISettingsStore | undefined {
  return req.app.get("settingsStore") as ISettingsStore | undefined;
}

function getSettingsSync(req: Request): ((settings: Settings) => Promise<void>) | undefined {
  return req.app.get("settingsSync") as ((settings: Settings) => Promise<void>) | undefined;
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

export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getSettingsStore(req);
    const settings = store?.getSettings();

    res.json({
      data: {
        theme: settings?.theme ?? "synthwave84",
        uiLayout: settings?.ui_layout ?? "dashboard",
        autoRefreshMs: settings?.auto_refresh_ms ?? 5000,
        maxTasksDisplay: settings?.max_tasks_display ?? 100,
        decompositionThreshold: settings?.decomposition_threshold ?? 5,
        budgetDefaultCap: settings?.budget_default_cap ?? 10,
        budgetSoftCapRatio: settings?.budget_soft_cap_ratio ?? 0.8,
        dispatchMaxConcurrency: settings?.dispatch_max_concurrency ?? 5,
        dispatchDefaultTimeoutMs: settings?.dispatch_default_timeout_ms ?? 120000,
      },
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
      auto_refresh_ms: store.getSettings()?.auto_refresh_ms ?? 5000,
      max_tasks_display: store.getSettings()?.max_tasks_display ?? 100,
      decomposition_threshold: store.getSettings()?.decomposition_threshold ?? 5,
      budget_default_cap: store.getSettings()?.budget_default_cap ?? 10,
      budget_soft_cap_ratio: store.getSettings()?.budget_soft_cap_ratio ?? 0.8,
      dispatch_max_concurrency: store.getSettings()?.dispatch_max_concurrency ?? 5,
      dispatch_default_timeout_ms: store.getSettings()?.dispatch_default_timeout_ms ?? 120000,
    });

    res.json({
      data: {
        id: settings.id,
        theme: settings.theme,
        uiLayout: settings.ui_layout,
        autoRefreshMs: settings.auto_refresh_ms,
        maxTasksDisplay: settings.max_tasks_display,
        decompositionThreshold: settings.decomposition_threshold,
        budgetDefaultCap: settings.budget_default_cap,
        budgetSoftCapRatio: settings.budget_soft_cap_ratio,
        dispatchMaxConcurrency: settings.dispatch_max_concurrency,
        dispatchDefaultTimeoutMs: settings.dispatch_default_timeout_ms,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getSettingsStore(req);
    if (!store) {
      throw new ApiError("Settings store not initialized", {
        statusCode: 500,
        code: "SETTINGS_STORE_NOT_FOUND",
      });
    }

    const body = req.body as Record<string, unknown>;
    const updates: Partial<Settings> = {};
    if (typeof body.theme === "string") {
      if (!["synthwave84", "tokyonight", "zenburn"].includes(body.theme)) {
        throw new ApiError("Invalid theme. Valid values: synthwave84, tokyonight, zenburn", {
          statusCode: 400,
          details: body.theme,
        });
      }
      updates.theme = body.theme as Theme;
    }
    if (typeof body.uiLayout === "string") {
      updates.ui_layout = body.uiLayout;
    }
    if (typeof body.autoRefreshMs === "number") {
      updates.auto_refresh_ms = body.autoRefreshMs;
    }
    if (typeof body.maxTasksDisplay === "number") {
      updates.max_tasks_display = body.maxTasksDisplay;
    }
    if (typeof body.decompositionThreshold === "number") {
      if (body.decompositionThreshold < 1) {
        throw new ApiError("decompositionThreshold must be at least 1", { statusCode: 400 });
      }
      updates.decomposition_threshold = body.decompositionThreshold;
    }
    if (typeof body.budgetDefaultCap === "number") {
      if (body.budgetDefaultCap <= 0) {
        throw new ApiError("budgetDefaultCap must be positive", { statusCode: 400 });
      }
      updates.budget_default_cap = body.budgetDefaultCap;
    }
    if (typeof body.budgetSoftCapRatio === "number") {
      if (body.budgetSoftCapRatio <= 0 || body.budgetSoftCapRatio > 1) {
        throw new ApiError("budgetSoftCapRatio must be between 0 and 1", { statusCode: 400 });
      }
      updates.budget_soft_cap_ratio = body.budgetSoftCapRatio;
    }
    if (typeof body.dispatchMaxConcurrency === "number") {
      if (body.dispatchMaxConcurrency < 1) {
        throw new ApiError("dispatchMaxConcurrency must be at least 1", { statusCode: 400 });
      }
      updates.dispatch_max_concurrency = body.dispatchMaxConcurrency;
    }
    if (typeof body.dispatchDefaultTimeoutMs === "number") {
      if (body.dispatchDefaultTimeoutMs < 1) {
        throw new ApiError("dispatchDefaultTimeoutMs must be at least 1", { statusCode: 400 });
      }
      updates.dispatch_default_timeout_ms = body.dispatchDefaultTimeoutMs;
    }

    const settings = store.updateSettings(updates);
    await getSettingsSync(req)?.(settings);

    res.json({
      data: {
        theme: settings.theme,
        uiLayout: settings.ui_layout,
        autoRefreshMs: settings.auto_refresh_ms,
        maxTasksDisplay: settings.max_tasks_display,
        decompositionThreshold: settings.decomposition_threshold,
        budgetDefaultCap: settings.budget_default_cap,
        budgetSoftCapRatio: settings.budget_soft_cap_ratio,
        dispatchMaxConcurrency: settings.dispatch_max_concurrency,
        dispatchDefaultTimeoutMs: settings.dispatch_default_timeout_ms,
      },
    });
  } catch (error) {
    next(error);
  }
}
