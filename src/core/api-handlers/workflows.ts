import { readFile } from "node:fs/promises";
import type { Request, Response, NextFunction } from "express";
import type {
  IWorkflowArtifactRepository,
  IHumanTaskRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "../workflow-repository.js";
import type {
  HumanTaskRecord,
  WorkflowArtifactRecord,
  WorkflowDefinition,
  WorkflowStep,
} from "../workflow-types.js";
import { ApiError } from "../api-types.js";

type HumanTaskResponder = (humanTaskId: string, response: unknown) => Promise<unknown>;

function toWorkflowDTO(definition: WorkflowDefinition): Record<string, unknown> {
  return {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    status: definition.status,
    description: definition.description,
    steps: definition.steps,
    metadata: definition.metadata,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

function toArtifactDTO(artifact: WorkflowArtifactRecord): Record<string, unknown> {
  return {
    id: artifact.id,
    taskId: artifact.taskId,
    workflowRunId: artifact.workflowRunId,
    stepId: artifact.stepId,
    title: artifact.title,
    kind: artifact.kind,
    mimeType: artifact.mimeType,
    fileName: artifact.fileName,
    storagePath: artifact.storagePath,
    sizeBytes: artifact.sizeBytes,
    contentUrl: `/api/artifacts/${artifact.id}/content`,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    metadata: artifact.metadata,
  };
}

function toHumanTaskDTO(task: HumanTaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    workflowRunId: task.workflowRunId,
    workflowId: task.workflowId,
    workflowVersion: task.workflowVersion,
    stepId: task.stepId,
    type: task.type,
    status: task.status,
    title: task.title,
    prompt: task.prompt,
    assignedTo: task.assignedTo,
    promptMode: task.promptMode,
    questions: task.questions,
    response: task.response,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    resolvedAt: task.resolvedAt,
  };
}

function isStepArray(value: unknown): value is WorkflowStep[] {
  return Array.isArray(value);
}

export async function listWorkflows(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRepository") as IWorkflowRepository;
    const workflows = await repository.getAll();
    res.json({ data: workflows.map(toWorkflowDTO), total: workflows.length });
  } catch (error) {
    next(error);
  }
}

export async function getWorkflow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRepository") as IWorkflowRepository;
    const { id } = req.params;
    const version = req.query.version !== undefined
      ? Number(req.query.version)
      : undefined;
    const workflow = await repository.get(id as string, Number.isFinite(version) ? version : undefined);
    if (!workflow) {
      throw new ApiError("Workflow not found", { statusCode: 404 });
    }
    res.json({ data: toWorkflowDTO(workflow) });
  } catch (error) {
    next(error);
  }
}

export async function createWorkflow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRepository") as IWorkflowRepository;
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.id !== "string"
      || typeof body.name !== "string"
      || !isStepArray(body.steps)
    ) {
      throw new ApiError("Invalid request body", { statusCode: 400 });
    }

    const version = typeof body.version === "number" ? body.version : 1;
    const now = Date.now();
    const definition: WorkflowDefinition = {
      id: body.id,
      name: body.name,
      version,
      status: (body.status as WorkflowDefinition["status"]) ?? "draft",
      description: typeof body.description === "string" ? body.description : undefined,
      steps: body.steps,
      metadata: body.metadata as Record<string, unknown> | undefined,
      createdAt: now,
      updatedAt: now,
    };
    await repository.save(definition);
    res.status(201).json({ data: toWorkflowDTO(definition) });
  } catch (error) {
    next(error);
  }
}

export async function updateWorkflow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRepository") as IWorkflowRepository;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const existing = await repository.get(id as string);
    if (!existing) {
      throw new ApiError("Workflow not found", { statusCode: 404 });
    }

    const now = Date.now();
    const version = typeof body.version === "number"
      ? body.version
      : existing.version + 1;
    const definition: WorkflowDefinition = {
      id: id as string,
      name: typeof body.name === "string" ? body.name : existing.name,
      version,
      status: (body.status as WorkflowDefinition["status"]) ?? existing.status,
      description: typeof body.description === "string"
        ? body.description
        : existing.description,
      steps: isStepArray(body.steps) ? body.steps : existing.steps,
      metadata: (body.metadata as Record<string, unknown> | undefined) ?? existing.metadata,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    await repository.save(definition);
    res.json({ data: toWorkflowDTO(definition) });
  } catch (error) {
    next(error);
  }
}

export async function listWorkflowRuns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRunRepository") as IWorkflowRunRepository;
    const filter = req.query as Record<string, unknown>;
    let runs = await repository.getAll();

    if (filter.workflowId) {
      runs = runs.filter((run) => run.workflowId === String(filter.workflowId));
    }
    if (filter.status) {
      runs = runs.filter((run) => run.status === String(filter.status));
    }
    if (filter.taskId) {
      runs = runs.filter((run) => run.taskId === String(filter.taskId));
    }

    res.json({ data: runs, total: runs.length });
  } catch (error) {
    next(error);
  }
}

export async function getWorkflowRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("workflowRunRepository") as IWorkflowRunRepository;
    const artifactRepository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    const { id } = req.params;
    const run = await repository.get(id as string);
    if (!run) {
      throw new ApiError("Workflow run not found", { statusCode: 404 });
    }
    const artifacts = artifactRepository ? await artifactRepository.getByWorkflowRun(run.id) : [];
    res.json({ data: { ...run, artifacts: artifacts.map(toArtifactDTO) } });
  } catch (error) {
    next(error);
  }
}

export async function listHumanTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("humanTaskRepository") as IHumanTaskRepository;
    const artifactRepository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    const filter = req.query as Record<string, unknown>;
    let tasks = filter.workflowRunId
      ? await repository.getByWorkflowRun(String(filter.workflowRunId))
      : await repository.listPending();

    if (filter.status) {
      tasks = tasks.filter((task) => task.status === filter.status);
    }

    const artifactsByRun = new Map<string, Record<string, unknown>[]>();
    if (artifactRepository) {
      for (const task of tasks) {
        if (!artifactsByRun.has(task.workflowRunId)) {
          const relatedArtifacts = await artifactRepository.getByWorkflowRun(task.workflowRunId);
          artifactsByRun.set(task.workflowRunId, relatedArtifacts.map(toArtifactDTO));
        }
      }
    }

    res.json({
      data: tasks.map((task) => ({
        ...toHumanTaskDTO(task),
        artifacts: artifactsByRun.get(task.workflowRunId) ?? [],
      })),
      total: tasks.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function respondToHumanTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const responder = req.app.get("humanTaskResponder") as HumanTaskResponder | undefined;
    if (!responder) {
      throw new ApiError("Human task responder is not configured", { statusCode: 501 });
    }
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    if (!("response" in body)) {
      throw new ApiError("Missing response", { statusCode: 400 });
    }
    const result = await responder(id as string, body.response);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function listArtifacts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    if (!repository) {
      res.json({ data: [], total: 0 });
      return;
    }

    const filter = req.query as Record<string, unknown>;
    const artifacts = filter.workflowRunId
      ? await repository.getByWorkflowRun(String(filter.workflowRunId))
      : filter.taskId
        ? await repository.getByTaskId(String(filter.taskId))
        : [];

    res.json({ data: artifacts.map(toArtifactDTO), total: artifacts.length });
  } catch (error) {
    next(error);
  }
}

export async function getArtifact(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    if (!repository) {
      throw new ApiError("Artifact repository is not configured", { statusCode: 501 });
    }

    const artifact = await repository.get(String(req.params.id));
    if (!artifact) {
      throw new ApiError("Artifact not found", { statusCode: 404 });
    }

    res.json({ data: toArtifactDTO(artifact) });
  } catch (error) {
    next(error);
  }
}

export async function getArtifactContent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    if (!repository) {
      throw new ApiError("Artifact repository is not configured", { statusCode: 501 });
    }

    const artifact = await repository.get(String(req.params.id));
    if (!artifact) {
      throw new ApiError("Artifact not found", { statusCode: 404 });
    }

    const content = await readFile(artifact.storagePath, "utf8");
    res.type(artifact.mimeType);
    res.send(content);
  } catch (error) {
    next(error);
  }
}
