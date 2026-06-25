import type { Request, Response, NextFunction, Router } from "express";
import express, { type Application } from "express";
import type { Server } from "http";
import type { Server as HTTPSServer } from "https";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { IAgentStore } from "./agent-store.js";
import type { IModelStore } from "./model-store.js";
import type { ITaskRepository } from "./task-repository.js";
import type {
  IWorkflowArtifactRepository,
  IHumanTaskRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "./workflow-repository.js";
import type { SSEEvent, ApiServerOptions } from "./api-types.js";
import { ApiError, isApiError } from "./api-types.js";
import type { FactoryEvent } from "./types.js";
import {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from "./api-handlers/agents.js";
import {
  listModels,
  getModel,
  addModel,
  updateModel,
  deleteModel,
} from "./api-handlers/models.js";
import {
  getTheme,
  setTheme,
} from "./api-handlers/settings.js";
import {
  listTasks,
  createTask,
  getTask,
  getTaskConversation,
} from "./api-handlers/tasks.js";
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  listWorkflowRuns,
  getWorkflowRun,
  listHumanTasks,
  respondToHumanTask,
  listArtifacts,
  getArtifact,
  getArtifactContent,
} from "./api-handlers/workflows.js";
import type { AgentRegistry } from "./agent-registry.js";
import type { ModelCatalog } from "./model-catalog.js";
import type { Tracer } from "./tracer.js";
import type { BudgetTracker } from "./budget-tracker.js";
import type { FinalResult, Task } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
//  API Server Class
// ─────────────────────────────────────────────────────────────────────────────

export class ApiServer {
  private app: Application;
  private server?: Server | HTTPSServer;
  private port: number;
  private host: string;
  private staticPath?: string;
  private corsOrigins: string | string[];
  private enableSse: boolean;

  private agentStore?: IAgentStore;
  private modelStore?: IModelStore;
  private taskRepository?: ITaskRepository;
  private workflowRepository?: IWorkflowRepository;
  private workflowRunRepository?: IWorkflowRunRepository;
  private humanTaskRepository?: IHumanTaskRepository;
  private artifactRepository?: IWorkflowArtifactRepository;
  private agentRegistry?: AgentRegistry;
  private modelCatalog?: ModelCatalog;
  private tracer?: Tracer;
  private budgetTracker?: BudgetTracker;
  private humanTaskResponder?: (humanTaskId: string, response: unknown) => Promise<FinalResult>;
  private taskSubmitter?: (input: Record<string, unknown>) => Promise<Task>;

  private sseClients = new Map<string, { res: Response; interval: NodeJS.Timeout }>();
  private sseInterval?: NodeJS.Timeout;

  constructor(options: ApiServerOptions = {}) {
    this.app = express();
    this.port = options.port ?? 3001;
    this.host = options.host ?? "localhost";
    this.staticPath = options.staticPath;
    this.corsOrigins = options.corsOrigins ?? "*";
    this.enableSse = options.enableSse ?? true;

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.setupCORS();
    this.setupRoutes();
    this.setupErrorHandler();
    this.setupStaticFiles();
  }

  private setupCORS(): void {
    const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
      const origins = Array.isArray(this.corsOrigins) ? this.corsOrigins : [this.corsOrigins];
      const origin = req.headers.origin ?? "*";

      if ( req.headers.origin && origins.some((allowed) => allowed === "*" || origin.includes(allowed))) {
        res.header("Access-Control-Allow-Origin", origin);
      }

      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");

      if (req.method === "OPTIONS") {
        res.status(204).send();
        return;
      }

      next();
    };

    this.app.use(corsMiddleware);
  }

  private setupRoutes(): void {
    const router = express.Router();

    router.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    this.setupAgentRoutes(router);
    this.setupModelRoutes(router);
    this.setupSettingsRoutes(router);
    this.setupTaskRoutes(router);
    this.setupWorkflowRoutes(router);
    this.setupSSE(router);

    this.app.use("/api", router);
  }

  private setupAgentRoutes(router: Router): void {
    router.get("/agents", this.wrapAsync(listAgents));
    router.get("/agents/:id", this.wrapAsync(getAgent));
    router.post("/agents", this.wrapAsync(createAgent));
    router.put("/agents/:id", this.wrapAsync(updateAgent));
    router.delete("/agents/:id", this.wrapAsync(deleteAgent));
  }

  private setupModelRoutes(router: Router): void {
    router.get("/models", this.wrapAsync(listModels));
    router.get("/models/:provider/:modelId", this.wrapAsync(getModel));
    router.post("/models", this.wrapAsync(addModel));
    router.put("/models/:provider/:modelId", this.wrapAsync(updateModel));
    router.delete("/models/:provider/:modelId", this.wrapAsync(deleteModel));
  }

  private setupSettingsRoutes(router: Router): void {
    router.get("/settings/theme", this.wrapAsync(getTheme));
    router.post("/settings/theme", this.wrapAsync(setTheme));
  }

  private setupTaskRoutes(router: Router): void {
    router.get("/tasks", this.wrapAsync(listTasks));
    router.post("/tasks", this.wrapAsync(createTask));
    router.get("/tasks/:id", this.wrapAsync(getTask));
    router.get("/tasks/:id/conversation", this.wrapAsync(getTaskConversation));
  }

  private setupWorkflowRoutes(router: Router): void {
    router.get("/workflows", this.wrapAsync(listWorkflows));
    router.get("/workflows/:id", this.wrapAsync(getWorkflow));
    router.post("/workflows", this.wrapAsync(createWorkflow));
    router.put("/workflows/:id", this.wrapAsync(updateWorkflow));
    router.get("/workflow-runs", this.wrapAsync(listWorkflowRuns));
    router.get("/workflow-runs/:id", this.wrapAsync(getWorkflowRun));
    router.get("/human-tasks", this.wrapAsync(listHumanTasks));
    router.post("/human-tasks/:id/respond", this.wrapAsync(respondToHumanTask));
    router.get("/artifacts", this.wrapAsync(listArtifacts));
    router.get("/artifacts/:id", this.wrapAsync(getArtifact));
    router.get("/artifacts/:id/content", this.wrapAsync(getArtifactContent));
  }

  private setupSSE(router: Router): void {
    if (!this.enableSse) return;

    router.get("/stream/tasks", (req, res) => {
      this.handleSSE(req, res);
    });
  }

  private setupStaticFiles(): void {
    if (this.staticPath && existsSync(this.staticPath)) {
      this.app.use(express.static(this.staticPath));
      this.app.get("/{*uiPath}", (req, res, next) => {
        if (req.path.startsWith("/api")) {
          next();
          return;
        }

        res.sendFile(join(this.staticPath!, "index.html"));
      });
    }
  }

  private setupErrorHandler(): void {
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
      const apiError = this.toApiError(err);
      res.status(apiError.statusCode).json({
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
      });
    });
  }

  private wrapAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction): Promise<void> => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  private toApiError(error: unknown): ApiError {
    if (isApiError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message, {
        statusCode: 500,
        code: "INTERNAL_ERROR",
        details: error.stack,
      });
    }

    return new ApiError(String(error), { statusCode: 500, code: "UNKNOWN_ERROR" });
  }

  private handleSSE(req: Request, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const interval = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    this.sseClients.set(clientId, { res, interval });

    req.on("close", () => {
      clearInterval(interval);
      this.sseClients.delete(clientId);
    });
  }

  public async initialize(
    agentStore?: IAgentStore,
    modelStore?: IModelStore,
    taskRepository?: ITaskRepository,
    workflowRepository?: IWorkflowRepository,
    workflowRunRepository?: IWorkflowRunRepository,
    humanTaskRepository?: IHumanTaskRepository,
    artifactRepository?: IWorkflowArtifactRepository,
    agentRegistry?: AgentRegistry,
    modelCatalog?: ModelCatalog,
    tracer?: Tracer,
    budgetTracker?: BudgetTracker,
    humanTaskResponder?: (humanTaskId: string, response: unknown) => Promise<FinalResult>,
    taskSubmitter?: (input: Record<string, unknown>) => Promise<Task>,
  ): Promise<void> {
    this.agentStore = agentStore;
    this.modelStore = modelStore;
    this.taskRepository = taskRepository;
    this.workflowRepository = workflowRepository;
    this.workflowRunRepository = workflowRunRepository;
    this.humanTaskRepository = humanTaskRepository;
    this.artifactRepository = artifactRepository;
    this.agentRegistry = agentRegistry;
    this.modelCatalog = modelCatalog;
    this.tracer = tracer;
    this.budgetTracker = budgetTracker;
    this.humanTaskResponder = humanTaskResponder;
    this.taskSubmitter = taskSubmitter;

    if (this.agentStore) {
      this.app.set("agentStore", this.agentStore);
    }
    if (this.modelStore) {
      this.app.set("modelStore", this.modelStore);
    }
    if (this.taskRepository) {
      this.app.set("taskRepository", this.taskRepository);
    }
    if (this.workflowRepository) {
      this.app.set("workflowRepository", this.workflowRepository);
    }
    if (this.workflowRunRepository) {
      this.app.set("workflowRunRepository", this.workflowRunRepository);
    }
    if (this.humanTaskRepository) {
      this.app.set("humanTaskRepository", this.humanTaskRepository);
    }
    if (this.artifactRepository) {
      this.app.set("artifactRepository", this.artifactRepository);
    }
    if (this.humanTaskResponder) {
      this.app.set("humanTaskResponder", this.humanTaskResponder);
    }
    if (this.taskSubmitter) {
      this.app.set("taskSubmitter", this.taskSubmitter);
    }

    if (this.enableSse && this.agentRegistry) {
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    if (!this.agentRegistry) return;

    this.agentRegistry.eventBus.on("agent:registered", (event: FactoryEvent) => {
      this.sendSSEEvent({
        type: "agent:updated",
        timestamp: Date.now(),
        data: { agentId: event.payload.agentId as string },
      });
    });

    this.agentRegistry.eventBus.on("agent:unregistered", (event: FactoryEvent) => {
      this.sendSSEEvent({
        type: "agent:updated",
        timestamp: Date.now(),
        data: { agentId: event.payload.agentId as string },
      });
    });
  }

  private sendSSEEvent(event: SSEEvent): void {
    if (!this.enableSse || this.sseClients.size === 0) return;

    const eventString = `data: ${JSON.stringify(event)}\n\n`;

    for (const [clientId, { res, interval }] of this.sseClients) {
      try {
        res.write(eventString);
      } catch {
        clearInterval(interval);
        clearInterval(this.sseInterval!);
        this.sseClients.delete(clientId);
      }
    }
  }

  public async start(): Promise<void> {
    this.server = this.app.listen(this.port, this.host, () => {
      console.log(`API server running at http://${this.host}:${this.port}`);
      console.log(`API docs available at http://${this.host}:${this.port}/api-docs`);
    });

    if (this.enableSse && this.sseClients.size > 0) {
      this.sseInterval = setInterval(() => {
        for (const [clientId, { res }] of this.sseClients) {
          try {
            res.write(": heartbeat\n\n");
          } catch {
            this.sseClients.delete(clientId);
          }
        }
      }, 30000);
    }
  }

  public async stop(): Promise<void> {
    if (this.server) {
      await new Promise((resolve) => this.server?.close(resolve));
      this.server = undefined;
    }

    if (this.sseInterval) {
      clearInterval(this.sseInterval);
      this.sseInterval = undefined;
    }

    for (const [_clientId, { res, interval }] of this.sseClients) {
      clearInterval(interval);
       res.end();
     }
    this.sseClients.clear();

    if (this.agentStore?.close) {
      await this.agentStore.close();
    }
    if (this.modelStore?.close) {
      await this.modelStore.close();
    }
    if (this.taskRepository?.close) {
      await this.taskRepository.close();
    }
    if (this.workflowRepository && "close" in this.workflowRepository && typeof this.workflowRepository.close === "function") {
      await this.workflowRepository.close();
    }
    if (this.workflowRunRepository && "close" in this.workflowRunRepository && typeof this.workflowRunRepository.close === "function") {
      await this.workflowRunRepository.close();
    }
    if (this.humanTaskRepository && "close" in this.humanTaskRepository && typeof this.humanTaskRepository.close === "function") {
      await this.humanTaskRepository.close();
    }
  }

  public getServer(): Server | HTTPSServer | undefined {
    return this.server;
  }

  public getApp(): Application {
    return this.app;
  }
}
