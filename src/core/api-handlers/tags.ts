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
    if (!body || typeof body.id !== "string" || typeof body.label !== "string") {
      throw new ApiError("Invalid request body", { statusCode: 400 });
    }

    const record = store.save({
      id: body.id,
      label: body.label,
      description: typeof body.description === "string" ? body.description : undefined,
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
    const record = store.update(id, {
      label: typeof body.label === "string" ? body.label : existing.label,
      description: typeof body.description === "string" ? body.description : existing.description,
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
