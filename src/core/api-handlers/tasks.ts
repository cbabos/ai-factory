import type { Request, Response, NextFunction } from "express";
import type { ITaskRepository, TaskRecord } from "../task-repository.js";
import type { Priority, Task } from "../types.js";
import { ApiError } from "../api-types.js";

// ─── Helper Functions ──────────────────────────────────────────────────────

type TaskStatus = "pending" | "running" | "completed" | "failed";

function _taskRecordToDTO(record: TaskRecord): Record<string, unknown> {
  return {
    id: record.id,
    task: record.task,
    result: record.result,
    status: record.status,
    conversation: record.conversation,
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
    const body = req.query as Record<string, unknown>;

    const records = await repository.getAll();
    let tasks = records.map(_taskRecordToDTO);

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
    const { id } = req.params;

    const record = await repository.get(id as string);

    if (!record) {
      throw new ApiError("Task not found", { statusCode: 404 });
    }

    res.json({ data: _taskRecordToDTO(record) });
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

    res.json({ data: record.conversation ?? [] });
  } catch (error) {
    next(error);
  }
}
