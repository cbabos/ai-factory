import type { Request, Response, NextFunction } from "express";
import type { ITaskRepository, TaskRecord } from "../task-repository.js";
import type {
  IWorkflowArtifactRepository,
  IWorkflowRunRepository,
} from "../workflow-repository.js";
import type { Priority, Task } from "../types.js";
import { ApiError } from "../api-types.js";

// ─── Helper Functions ──────────────────────────────────────────────────────

type TaskStatus = "pending" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled";

async function _taskRecordToDTO(
  record: TaskRecord,
  workflowRunRepository?: IWorkflowRunRepository,
  artifactRepository?: IWorkflowArtifactRepository,
): Promise<Record<string, unknown>> {
  const workflowRun = workflowRunRepository
    ? await workflowRunRepository.getByTaskId(record.id)
    : undefined;
  const artifacts = artifactRepository
    ? await artifactRepository.getByTaskId(record.id)
    : [];
  return {
    id: record.id,
    task: record.task,
    result: record.result,
    status: record.status,
    conversation: record.conversation,
    workflowRunId: workflowRun?.id,
    workflowRunStatus: workflowRun?.status,
    artifacts: artifacts.map((artifact) => ({
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
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// ─── Task Handlers ─────────────────────────────────────────────────────────

export async function listTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("taskRepository") as ITaskRepository;
    const workflowRunRepository = req.app.get("workflowRunRepository") as IWorkflowRunRepository | undefined;
    const artifactRepository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    const body = req.query as Record<string, unknown>;

    const records = await repository.getAll();
    let tasks = await Promise.all(records.map((record) => _taskRecordToDTO(record, workflowRunRepository, artifactRepository)));

    const statusFilter = body.status as TaskStatus | undefined;
    if (statusFilter) {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    const startDateFilter = body.startDate as number;
    if (startDateFilter !== undefined) {
      tasks = tasks.filter((t) => (t.createdAt as number) >= startDateFilter);
    }

    const endDateFilter = body.endDate as number;
    if (endDateFilter !== undefined) {
      tasks = tasks.filter((t) => (t.createdAt as number) <= endDateFilter);
    }

    const agentIdFilter = body.agentId as string;
    if (agentIdFilter) {
      tasks = tasks.filter((t) => (t.task as Task).origin?.channel === agentIdFilter);
    }

    const priorityFilter = body.priority as Priority;
    if (priorityFilter) {
      tasks = tasks.filter((t) => (t.task as Task).priority === priorityFilter);
    }

    const total = tasks.length;
    const page = parseInt(body.page?.toString() ?? "1", 10);
    const pageSize = parseInt(body.pageSize?.toString() ?? "50", 10);
    const skip = (page - 1) * pageSize;

    const paginatedTasks = tasks.slice(skip, skip + pageSize);

    res.json({
      items: paginatedTasks,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("taskRepository") as ITaskRepository;
    const workflowRunRepository = req.app.get("workflowRunRepository") as IWorkflowRunRepository | undefined;
    const artifactRepository = req.app.get("artifactRepository") as IWorkflowArtifactRepository | undefined;
    const { id } = req.params;

    const record = await repository.get(id as string);

    if (!record) {
      throw new ApiError("Task not found", { statusCode: 404 });
    }

    res.json({ data: await _taskRecordToDTO(record, workflowRunRepository, artifactRepository) });
  } catch (error) {
    next(error);
  }
}

export async function getTaskConversation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("taskRepository") as ITaskRepository;
    const { id } = req.params;

    const record = await repository.get(id as string);

    if (!record) {
      throw new ApiError("Task not found", { statusCode: 404 });
    }

    const conversation = await repository.getConversation(id as string);
    res.json({ data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const submitter = req.app.get("taskSubmitter") as ((input: Record<string, unknown>) => Promise<Task>) | undefined;
    if (!submitter) {
      throw new ApiError("Task submission is not configured", { statusCode: 501 });
    }

    const body = req.body as Record<string, unknown>;
    if (
      typeof body.description !== "string"
      || body.description.trim().length === 0
    ) {
      throw new ApiError("Task description is required", { statusCode: 400 });
    }

    const task = await submitter(body);
    res.status(201).json({
      data: {
        id: task.id,
        task,
        status: "pending",
        createdAt: task.createdAt,
        updatedAt: task.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function resubmitTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repository = req.app.get("taskRepository") as ITaskRepository;
    const submitter = req.app.get("taskSubmitter") as ((input: Record<string, unknown>) => Promise<Task>) | undefined;
    if (!submitter) {
      throw new ApiError("Task submission is not configured", { statusCode: 501 });
    }

    const { id } = req.params;
    const record = await repository.get(id as string);
    if (!record) {
      throw new ApiError("Task not found", { statusCode: 404 });
    }

    if (record.status !== "failed" && record.status !== "cancelled") {
      throw new ApiError("Only failed or cancelled tasks can be resubmitted", { statusCode: 409 });
    }

    const original = record.task;
    const context = structuredClone(original.context);
    context.resubmittedFrom = original.id;

    const task = await submitter({
      description: original.description,
      priority: original.priority,
      context,
      workflowId: original.workflow?.workflowId,
      workflowVersion: original.workflow?.workflowVersion,
    });

    res.status(201).json({
      data: {
        id: task.id,
        task,
        status: "pending",
        createdAt: task.createdAt,
        updatedAt: task.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
