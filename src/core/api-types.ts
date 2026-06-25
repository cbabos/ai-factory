import type {
  Provider,
} from "./types.js";

export type Theme = "synthwave84" | "tokyonight" | "zenburn";

export interface ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
}

export class ApiErrorImpl extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, options?: { statusCode?: number; code?: string; details?: unknown }) {
    super(message);
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export const ApiError = ApiErrorImpl;

export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    typeof (error as ApiError).statusCode === "number"
  );
}

export interface ApiServerOptions {
  port?: number;
  host?: string;
  staticPath?: string;
  corsOrigins?: string | string[];
  enableSse?: boolean;
}

export interface SSEEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface TaskCreatedEvent extends SSEEvent {
  type: "task:created";
  data: {
    taskId: string;
    description: string;
    originChannel: string;
  };
}

export interface TaskCompletedEvent extends SSEEvent {
  type: "task:completed";
  data: {
    taskId: string;
    success: boolean;
    totalCost: number;
    totalTokens: number;
  };
}

export interface TaskFailedEvent extends SSEEvent {
  type: "task:failed";
  data: {
    taskId: string;
    error: string;
  };
}

export interface ModelUpdatedEvent extends SSEEvent {
  type: "model:updated";
  data: {
    provider: Provider;
    modelId: string;
  };
}

export interface AgentUpdatedEvent extends SSEEvent {
  type: "agent:updated";
  data: {
    agentId: string;
  };
}

export type AgentRuntimeSync =
  | {
      action: "upsert";
      agentId: string;
    }
  | {
      action: "delete";
      agentId: string;
    };

export type SSEEventType =
  | TaskCreatedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | ModelUpdatedEvent
  | AgentUpdatedEvent;
