import type { Request, Response, NextFunction } from "express";
import type { IAgentStore, AgentRecord } from "../agent-store.js";
import { ApiError } from "../api-types.js";

function _agentRecordToDTO(agent: AgentRecord): Record<string, unknown> {
  return {
    id: agent.id,
    name: agent.name,
    tags: agent.tags,
    complexityMin: agent.complexityMin,
    complexityMax: agent.complexityMax,
    tokenProfile: {
      min: agent.tokenProfile.min,
      max: agent.tokenProfile.max,
      typical: agent.tokenProfile.typical,
    },
    preferredModels: agent.preferredModels,
    timeoutMs: agent.timeoutMs,
    maxRetries: agent.maxRetries,
    version: agent.version,
    isActive: agent.isActive,
    configSource: agent.configSource,
    description: agent.description,
    metadata: agent.metadata,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

interface ParsedTokenProfile {
  min: number;
  max: number;
  typical: number;
}

function _parseTokenProfile(body: Record<string, unknown>): ParsedTokenProfile | null {
  const nested = body.tokenProfile as Record<string, unknown> | undefined;
  const min = nested?.min ?? body.tokenProfileMin;
  const max = nested?.max ?? body.tokenProfileMax;
  const typical = nested?.typical ?? body.tokenProfileTypical;

  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    typeof typical !== "number"
  ) {
    return null;
  }

  return { min, max, typical };
}

export async function listAgents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("agentStore") as IAgentStore;
    const filter = req.query as Record<string, unknown>;

    const tags = Array.isArray(filter.tags)
      ? (filter.tags as string[])
      : (filter.tags ? [filter.tags as string] : []);

    let agents: AgentRecord[] = [];

    if (tags.length > 0) {
      agents = store.findByTags(tags);
    } else {
      agents = store.getAll();
    }

    if (filter.isActive !== undefined) {
      const isActive = filter.isActive as string;
      if (isActive === "true") {
        agents = agents.filter((a) => a.isActive);
      } else if (isActive === "false") {
        agents = agents.filter((a) => !a.isActive);
      }
    }

    if (filter.configSource !== undefined) {
      agents = agents.filter((a) => a.configSource === filter.configSource);
    }

    const total = agents.length;
    const items = agents.map(_agentRecordToDTO);

    res.json({ data: items, total });
  } catch (error) {
    next(error);
  }
}

export async function getAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("agentStore") as IAgentStore;
    const { id } = req.params;

    const agent = store.get(id as string);

    if (!agent) {
      throw new ApiError("Agent not found", { statusCode: 404 });
    }

    res.json({ data: _agentRecordToDTO(agent) });
  } catch (error) {
    next(error);
  }
}

export async function createAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("agentStore") as IAgentStore;

    const body = req.body as Record<string, unknown>;
    const tokenProfile = _parseTokenProfile(body);
    if (
      !body ||
      typeof body.id !== "string" ||
      typeof body.name !== "string" ||
      !Array.isArray(body.tags) ||
      typeof body.complexityMin !== "number" ||
      typeof body.complexityMax !== "number" ||
      tokenProfile === null
    ) {
      throw new ApiError("Invalid request body", { statusCode: 400 });
    }

    const record = store.save({
      id: body.id,
      name: body.name,
      tags: body.tags,
      complexityMin: body.complexityMin,
      complexityMax: body.complexityMax,
      tokenProfileMin: tokenProfile.min,
      tokenProfileMax: tokenProfile.max,
      tokenProfileTypical: tokenProfile.typical,
      preferredModels: body.preferredModels as string[] | undefined,
      timeoutMs: (body.timeoutMs as number) ?? 30000,
      maxRetries: (body.maxRetries as number) ?? 2,
      configSource: (body.configSource as "static" | "custom") ?? "static",
      description: body.description as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });

    res.status(201).json({ data: _agentRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function updateAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("agentStore") as IAgentStore;
    const { id } = req.params;

    const body = req.body as Record<string, unknown>;
    const tokenProfile = _parseTokenProfile(body);

    const existing = store.get(id as string);
    if (!existing) {
      throw new ApiError("Agent not found", { statusCode: 404 });
    }

    const updates: Record<string, unknown> = {
      name: body.name ?? existing.name,
      tags: body.tags ?? existing.tags,
      complexityMin: body.complexityMin ?? existing.complexityMin,
      complexityMax: body.complexityMax ?? existing.complexityMax,
      tokenProfileMin: tokenProfile?.min ?? existing.tokenProfile.min,
      tokenProfileMax: tokenProfile?.max ?? existing.tokenProfile.max,
      tokenProfileTypical: tokenProfile?.typical ?? existing.tokenProfile.typical,
      preferredModels: body.preferredModels ?? existing.preferredModels,
      timeoutMs: body.timeoutMs ?? existing.timeoutMs,
      maxRetries: body.maxRetries ?? existing.maxRetries,
      description: body.description ?? existing.description,
      metadata: body.metadata ?? existing.metadata,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    };

    const record = store.update(id as string, {
      id: id as string,
      name: updates.name as string,
      tags: updates.tags as string[],
      complexityMin: updates.complexityMin as number,
      complexityMax: updates.complexityMax as number,
      tokenProfileMin: updates.tokenProfileMin as number,
      tokenProfileMax: updates.tokenProfileMax as number,
      tokenProfileTypical: updates.tokenProfileTypical as number,
      preferredModels: updates.preferredModels as string[] | undefined,
      timeoutMs: updates.timeoutMs as number,
      maxRetries: updates.maxRetries as number,
      description: updates.description as string | undefined,
      metadata: updates.metadata as Record<string, unknown> | undefined,
      isActive: updates.isActive as boolean | undefined,
    });

    res.json({ data: _agentRecordToDTO(record) });
  } catch (error) {
    next(error);
  }
}

export async function deleteAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const store = req.app.get("agentStore") as IAgentStore;
    const { id } = req.params;

    const existing = store.get(id as string);
    if (!existing) {
      throw new ApiError("Agent not found", { statusCode: 404 });
    }

    store.softDelete(id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
