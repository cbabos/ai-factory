import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../api-types.js";
import type { ITagStore, TagRecord } from "../tag-store.js";

function tagRecordToDTO(tag: TagRecord): Record<string, unknown> {
  return {
    id: tag.id,
    label: tag.label,
    description: tag.description,
    version: tag.version,
    isActive: tag.isActive,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

function getStore(req: Request): ITagStore {
  return req.app.get("tagStore") as ITagStore;
}

function normalizeTagLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function normalizeTagDescription(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function assertUniqueLabel(store: ITagStore, label: string, currentId?: string): void {
  const target = label.toLowerCase();
  const duplicate = store.getAll().find((tag) =>
    tag.id !== currentId && tag.label.trim().toLowerCase() === target,
  );

  if (duplicate) {
    throw new ApiError(`A tag named "${duplicate.label}" already exists`, { statusCode: 409 });
  }
}

export async function listTags(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getStore(req);
    const tags = req.query.isActive === "true" ? store.getAllActive() : store.getAll();
    res.json({ data: tags.map(tagRecordToDTO), total: tags.length });
  } catch (error) {
    next(error);
  }
}

export async function getTag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getStore(req);
    const tag = store.get(req.params.id as string);
    if (!tag) {
      throw new ApiError("Tag not found", { statusCode: 404 });
    }
    res.json({ data: tagRecordToDTO(tag) });
  } catch (error) {
    next(error);
  }
}

export async function createTag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getStore(req);
    const body = req.body as Record<string, unknown>;
    const label = normalizeTagLabel(body?.label);
    if (!body || typeof body.id !== "string" || label === null) {
      throw new ApiError("Invalid request body", { statusCode: 400 });
    }

    assertUniqueLabel(store, label);

    const record = store.save({
      id: body.id,
      label,
      description: normalizeTagDescription(body.description),
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    res.status(201).json({ data: tagRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function updateTag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getStore(req);
    const id = req.params.id as string;
    const existing = store.get(id);
    if (!existing) {
      throw new ApiError("Tag not found", { statusCode: 404 });
    }

    const body = req.body as Record<string, unknown>;
    const label = normalizeTagLabel(body.label) ?? existing.label;
    assertUniqueLabel(store, label, id);
    const record = store.update(id, {
      label,
      description: normalizeTagDescription(body.description) ?? existing.description,
      isActive: typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
    });
    res.json({ data: tagRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function deleteTag(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = getStore(req);
    const id = req.params.id as string;
    const existing = store.get(id);
    if (!existing) {
      throw new ApiError("Tag not found", { statusCode: 404 });
    }

    store.softDelete(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
