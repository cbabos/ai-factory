import type { Request, Response, NextFunction } from "express";
import type { IModelStore, ModelRecord } from "../model-store.js";
import type { Provider } from "../types.js";
import { ApiError } from "../api-types.js";

// ─── Helper Functions ──────────────────────────────────────────────────────

function _modelRecordToDTO(model: ModelRecord): Record<string, unknown> {
  return {
    id: model.id,
    provider: model.provider as Provider,
    modelId: model.modelId,
    maxTokens: model.maxTokens,
    costPer1kInput: model.costPer1kInput,
    costPer1kOutput: model.costPer1kOutput,
    capabilities: model.capabilities,
    ownedBy: model.ownedBy,
    version: model.version,
    isActive: model.isActive,
    discoveredAt: model.discoveredAt,
    configSource: model.configSource,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

// ─── Model Handlers ────────────────────────────────────────────────────────

export async function listModels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("modelStore") as IModelStore;
    const filter = req.query as Record<string, unknown>;

    let models: ModelRecord[] = [];

    const isActiveFilter = filter.isActive;
    if (isActiveFilter === true || isActiveFilter === "true") {
      models = store.getAllActive();
    } else if (isActiveFilter === false || isActiveFilter === "false") {
      models = store.getAll();
    } else {
      models = store.getAll();
    }

    const providerFilter = filter.provider as string | undefined;
    if (providerFilter) {
      models = models.filter((m) => m.provider === providerFilter);
    }

    const capabilityFilter = filter.capability as string | undefined;
    if (capabilityFilter) {
      models = models.filter((m) => m.capabilities.includes(capabilityFilter));
    }

    const total = models.length;
    const items = models.map(_modelRecordToDTO);

    res.json({ data: items, total });
  } catch (error) {
    next(error);
  }
}

export async function getModel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("modelStore") as IModelStore;
    const { provider, modelId } = req.params;

    const model = store.get(provider as string, modelId as string);

    if (!model) {
      throw new ApiError("Model not found", { statusCode: 404 });
    }

    res.json({ data: _modelRecordToDTO(model) });
  } catch (error) {
    next(error);
  }
}

export async function addModel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("modelStore") as IModelStore;

    const body = req.body as Record<string, unknown>;
    if (
      !body ||
      typeof body.provider !== "string" ||
      typeof body.modelId !== "string"
    ) {
      throw new ApiError("Invalid request body", { statusCode: 400 });
    }

    const record = store.save({
      provider: body.provider as Provider,
      modelId: body.modelId,
      maxTokens: (body.maxTokens as number) ?? 4096,
      costPer1kInput: (body.costPer1kInput as number) ?? 0.001,
      costPer1kOutput: (body.costPer1kOutput as number) ?? 0.001,
      capabilities: (body.capabilities as string[]) ?? [],
      ownedBy: typeof body.ownedBy === "string" ? body.ownedBy : undefined,
      configSource: (body.configSource as "static" | "discovered") ?? "static",
      discoveredAt: (body.discoveredAt as number) ?? 0,
    });

    res.status(201).json({ data: _modelRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function updateModel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("modelStore") as IModelStore;
    const { provider, modelId } = req.params;

    const body = req.body as Record<string, unknown>;

    const existing = store.get(provider as string, modelId as string);
    if (!existing) {
      throw new ApiError("Model not found", { statusCode: 404 });
    }

    const updates: Record<string, unknown> = {
      maxTokens: body.maxTokens as number | undefined,
      costPer1kInput: body.costPer1kInput as number | undefined,
      costPer1kOutput: body.costPer1kOutput as number | undefined,
      capabilities: body.capabilities as string[] | undefined,
      ownedBy: body.ownedBy as string | undefined,
      isActive: body.isActive as boolean | undefined,
    };

    const record = store.update(provider as string, modelId as string, {
      provider: (updates.provider ?? provider) as Provider,
      modelId: (updates.modelId ?? modelId) as string,
      maxTokens: (updates.maxTokens ?? existing.maxTokens) as number,
      costPer1kInput: (updates.costPer1kInput ?? existing.costPer1kInput) as number,
      costPer1kOutput: (updates.costPer1kOutput ?? existing.costPer1kOutput) as number,
      capabilities: (updates.capabilities ?? existing.capabilities) as string[],
      ownedBy: (updates.ownedBy ?? existing.ownedBy) as string | undefined,
      isActive: (updates.isActive ?? existing.isActive) as boolean,
    });

    res.json({ data: _modelRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function deleteModel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("modelStore") as IModelStore;
    const { provider, modelId } = req.params;

    const existing = store.get(provider as string, modelId as string);
    if (!existing) {
      throw new ApiError("Model not found", { statusCode: 404 });
    }

    store.softDelete(provider as string, modelId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
