import {
  FactoryConfig,
  ILLMCaller,
  ISensor,
  ISignalAdapter,
  IResponder,
  Task,
  FinalResult,
  Provider,
  HealthCheck,
  IRepository,
  ModelInfo,
  WorkflowEngine,
  RoutingLLMCaller,
} from "./core/index.js";
import type { IAgent } from "./core/index.js";
import {
  EventBus,
  Tracer,
  BudgetTracker,
  AgentRegistry,
  Orchestrator,
  Dispatcher,
  ModelSelector,
  ModelCatalog,
  Aggregator,
  ComplexityEstimator,
  TaskDecomposer,
  TaskFactory,
  Prioritizer,
  InMemoryTaskQueue,
  ConsoleLogger,
  NoopLogger,
  RateLimiter,
  CircuitBreaker,
  ResilientLLMCaller,
  MetricsCollector,
  HealthChecker,
  DEFAULT_CAPABILITY_TAGS,
  type ILogger,
} from "./core/index.js";
import {
  OpenAICaller,
  AnthropicCaller,
  GoogleCaller,
  createOllamaCaller,
  createOmlxCaller,
  createMistralCaller,
  createGroqCaller,
  createDeepseekCaller,
} from "./llm/index.js";
import { ConfigurableAgent } from "./agents/index.js";
import type { IToolRegistry } from "./tools/interfaces.js";
import type { ITaskRepository } from "./core/task-repository.js";
import type {
  IWorkflowArtifactRepository,
  IHumanTaskRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "./core/workflow-repository.js";
import type { SecretsProvider } from "./core/secrets.js";
import { SQLiteAgentStore } from "./core/agent-store.js";
import { SQLiteModelStore } from "./core/model-store.js";
import { SQLiteTagStore } from "./core/tag-store.js";
import { SQLiteConfigStore } from "./core/sqlite-config-store.js";
import { ApiServer } from "./core/api-server.js";
import { setSettingsStore as setupSettingsStore } from "./core/api-handlers/settings.js";
import type { AgentRuntimeSync, ModelRuntimeSync } from "./core/api-types.js";
import { normalizeFactoryConfig } from "./core/config-loader.js";

export interface AIFactoryOptions {
  config: FactoryConfig;
  secrets: SecretsProvider;
  callers?: Map<Provider, ILLMCaller>;
  logger?: ILogger;
  repository?: IRepository<{ id: string }>;
  taskRepository?: ITaskRepository;
  workflowRepository?: IWorkflowRepository;
  workflowRunRepository?: IWorkflowRunRepository;
  humanTaskRepository?: IHumanTaskRepository;
  artifactRepository?: IWorkflowArtifactRepository;
  tools?: IToolRegistry;
  apiServerOptions?: import("./core/api-types.js").ApiServerOptions;
}

export class AIFactory {
  private eventBus: EventBus;
  private tracer: Tracer;
  private budgetTracker: BudgetTracker;
  private agentRegistry: AgentRegistry;
  private orchestrator: Orchestrator;
  private taskFactory: TaskFactory;
  private prioritizer: Prioritizer;
  private taskQueue: InMemoryTaskQueue;
  private logger: ILogger;
  private metricsCollector: MetricsCollector;
  private healthChecker: HealthChecker;
  private repository?: IRepository<{ id: string }>;
  private taskRepository?: ITaskRepository;
  private workflowRepository?: IWorkflowRepository;
  private workflowRunRepository?: IWorkflowRunRepository;
  private humanTaskRepository?: IHumanTaskRepository;
  private artifactRepository?: IWorkflowArtifactRepository;

  private config: Required<FactoryConfig>;
  private callers: Map<Provider, ILLMCaller>;
  private breakers = new Map<Provider, CircuitBreaker>();
  private defaultModel: string;
  private defaultModelProvider: Provider;
  private defaultCaller: ILLMCaller;
  private routingCaller?: ILLMCaller;
  private dispatcher: Dispatcher;
  private aggregator: Aggregator;
  private workflowEngine?: WorkflowEngine;
  private tools?: IToolRegistry;
  private agents: Map<string, IAgent>;

  private sensors: ISensor[] = [];
  private adapters = new Map<string, ISignalAdapter>();
  private responders = new Map<string, IResponder>();
  private running = false;
  private apiServer?: ApiServer;
  private settingsStore?: SQLiteConfigStore;
  private agentStore?: SQLiteAgentStore;
  private modelStore?: SQLiteModelStore;
  private tagStore?: SQLiteTagStore;
  private baseCatalogModels: ModelInfo[];
  private currentCatalog: ModelInfo[] = [];
  private currentProviders: Provider[] = [];

  constructor(options: AIFactoryOptions) {
    const {
      config,
      secrets,
      callers: injectedCallers,
      logger,
      repository,
      taskRepository,
      workflowRepository,
      workflowRunRepository,
      humanTaskRepository,
      artifactRepository,
      tools,
      apiServerOptions,
    } = options;

    this.config = normalizeFactoryConfig(config);
    this.logger = logger ?? new ConsoleLogger({ namespace: "AIFactory", level: "info" });
    this.repository = repository as IRepository<{ id: string }> | undefined;
    this.taskRepository = taskRepository;
    this.workflowRepository = workflowRepository;
    this.workflowRunRepository = workflowRunRepository;
    this.humanTaskRepository = humanTaskRepository;
    this.artifactRepository = artifactRepository;
    this.tools = tools;
    this.eventBus = new EventBus(new NoopLogger());
    this.tracer = new Tracer();

    if (apiServerOptions) {
      this.apiServer = new ApiServer(apiServerOptions);
      this.agentStore = new SQLiteAgentStore("./ai-factory.db");
      this.modelStore = new SQLiteModelStore("./ai-factory.db");
      this.tagStore = new SQLiteTagStore("./ai-factory.db");
    }

    const runtimeModels = this.resolveRuntimeModels(this.config.models);
    const runtimeAgents = this.resolveRuntimeAgents(this.config.agents);
    this.baseCatalogModels = runtimeModels;
    this.currentCatalog = runtimeModels;

    this.budgetTracker = new BudgetTracker(this.eventBus);
    this.agentRegistry = new AgentRegistry(this.eventBus);

    this.metricsCollector = new MetricsCollector(this.eventBus);

    this.callers = injectedCallers ?? this.buildCallers(runtimeModels, secrets, this.breakers);
    const providers = [...new Set([
      ...runtimeModels.map((m) => m.provider),
      ...this.callers.keys(),
    ])];
    this.currentProviders = providers;
    this.applyRuntimeSettings();

    const defaultCaller = this.callers.values().next().value;
    if (!defaultCaller) {
      throw new Error("No LLM callers configured");
    }
    this.defaultCaller = defaultCaller;
    this.routingCaller = new RoutingLLMCaller(this.callers);
    this.defaultModel = "";
    this.defaultModelProvider = defaultCaller.provider;
    this.updateEstimatorSelection(runtimeModels);

    // `agents` and `dispatcher` are rebuilt after initialize() discovers which
    // models are actually available, so the runtime can fall back to the first
    // available model when the config does not name one.
    this.agents = new Map<string, IAgent>();
    this.loadRuntimeAgents(runtimeAgents);
    this.dispatcher = new Dispatcher(
      this.agentRegistry,
      this.agents,
      this.config.dispatch.maxConcurrency,
      async (subTask, result) => {
        if (!this.taskRepository || !result.conversation || result.conversation.length === 0) {
          return;
        }
        await this.taskRepository.appendConversation(subTask.parentTaskId, result.conversation);
      },
    );

    this.healthChecker = new HealthChecker(
      this.buildHealthChecks(this.breakers),
      30_000,
    );

    this.aggregator = new Aggregator();
    this.taskFactory = new TaskFactory();
    this.prioritizer = new Prioritizer();
    this.taskQueue = new InMemoryTaskQueue();

    // Use the static catalog as a starting point; initialize() will merge in
    // discovered models and pick a default estimator model if needed.
    this.orchestrator = this.buildOrchestrator(runtimeModels);
    this.workflowEngine = this.buildWorkflowEngine(runtimeModels);
  }

  registerSensor(sensor: ISensor): void {
    this.sensors.push(sensor);
  }

  registerAdapter(adapter: ISignalAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  registerResponder(responder: IResponder): void {
    this.responders.set(responder.channel, responder);
  }

  setSettingsStore(store: SQLiteConfigStore): void {
    this.settingsStore = store;
    if (this.apiServer) {
      setupSettingsStore(this.apiServer.getApp(), store);
    }
  }

  async initialize(): Promise<void> {
    this.ensureDefaultTagsPersisted();
    this.ensureDefaultSettingsPersisted();
    this.applyRuntimeSettings();

    const runtimeModels = this.resolveRuntimeModels(this.config.models);
    this.baseCatalogModels = runtimeModels;

    const catalog = new ModelCatalog(
      [...this.callers.values()],
      runtimeModels,
      this.logger,
    );

    if (this.apiServer) {
      await this.apiServer.initialize(
        this.agentStore,
        this.modelStore,
        this.tagStore,
        this.taskRepository,
        this.workflowRepository,
        this.workflowRunRepository,
        this.humanTaskRepository,
        this.artifactRepository,
        this.agentRegistry,
        catalog,
        this.tracer,
        this.budgetTracker,
        async (humanTaskId, response) => this.respondToHumanTask(humanTaskId, response),
        async (input) => this.submitApiTask(input),
        (event) => this.syncRuntimeAgents(event),
        async (event) => this.syncRuntimeModels(event),
        async (settings) => this.applyPersistedSettings(settings),
      );
    }

    let discovered: { provider: string; modelId: string; ownedBy?: string }[] = [];
    try {
      const entries = await catalog.discoverAll();
      discovered = entries.map((e) => ({
        provider: e.discovered.provider,
        modelId: e.discovered.modelId,
        ownedBy: e.discovered.ownedBy,
      }));
      this.logger.info(`Discovered ${discovered.length} model(s): ${discovered.map((m) => `${m.provider}:${m.modelId}`).join(", ") || "none"}`);
    } catch (err) {
      this.logger.warn(
        "Model discovery failed, falling back to static catalog:",
        err instanceof Error ? err.message : String(err),
      );
    }

    this.currentCatalog = runtimeModels;
    this.updateEstimatorSelection(runtimeModels);

    this.orchestrator = this.buildOrchestrator(runtimeModels);
    this.workflowEngine = this.buildWorkflowEngine(runtimeModels);
  }

  private ensureDefaultSettingsPersisted(): void {
    if (!this.settingsStore || this.settingsStore.getSettings()) {
      return;
    }

    this.settingsStore.saveSettings({
      theme: "synthwave84",
      ui_layout: "dashboard",
      auto_refresh_ms: 5000,
      max_tasks_display: 100,
      decomposition_threshold: this.config.complexity.decompositionThreshold,
      budget_default_cap: this.config.budget.defaultCap,
      budget_soft_cap_ratio: this.config.budget.softCapRatio,
      dispatch_max_concurrency: this.config.dispatch.maxConcurrency,
      dispatch_default_timeout_ms: this.config.dispatch.defaultTimeoutMs,
    });
  }

  private async applyPersistedSettings(settings: import("./core/types.js").Settings): Promise<void> {
    this.config.complexity.decompositionThreshold = settings.decomposition_threshold;
    this.config.budget.defaultCap = settings.budget_default_cap;
    this.config.budget.softCapRatio = settings.budget_soft_cap_ratio;
    this.config.dispatch.maxConcurrency = settings.dispatch_max_concurrency;
    this.config.dispatch.defaultTimeoutMs = settings.dispatch_default_timeout_ms;
    this.applyRuntimeSettings();
    this.orchestrator = this.buildOrchestrator(this.currentCatalog);
    this.workflowEngine = this.buildWorkflowEngine(this.currentCatalog);
  }

  private applyRuntimeSettings(): void {
    const persisted = this.settingsStore?.getSettings();
    const defaultCap = persisted?.budget_default_cap ?? this.config.budget.defaultCap;
    const softCapRatio = persisted?.budget_soft_cap_ratio ?? this.config.budget.softCapRatio;
    const maxConcurrency = persisted?.dispatch_max_concurrency ?? this.config.dispatch.maxConcurrency;
    const decompositionThreshold = persisted?.decomposition_threshold ?? this.config.complexity.decompositionThreshold;
    const defaultTimeoutMs = persisted?.dispatch_default_timeout_ms ?? this.config.dispatch.defaultTimeoutMs;

    this.config.budget.defaultCap = defaultCap;
    this.config.budget.softCapRatio = softCapRatio;
    this.config.dispatch.maxConcurrency = maxConcurrency;
    this.config.dispatch.defaultTimeoutMs = defaultTimeoutMs;
    this.config.complexity.decompositionThreshold = decompositionThreshold;

    this.budgetTracker.loadConfig({
      defaultCap,
      softCapRatio,
    });
    this.budgetTracker.initialize(this.currentProviders);
    this.dispatcher = new Dispatcher(
      this.agentRegistry,
      this.agents,
      maxConcurrency,
      async (subTask, result) => {
        if (!this.taskRepository || !result.conversation || result.conversation.length === 0) {
          return;
        }
        await this.taskRepository.appendConversation(subTask.parentTaskId, result.conversation);
      },
    );
  }

  private syncRuntimeAgents(_event: AgentRuntimeSync): void {
    if (this.agentStore) {
      const runtimeAgents = this.resolveRuntimeAgents(this.config.agents);
      this.loadRuntimeAgents(runtimeAgents);
      return;
    }

    this.loadRuntimeAgents(this.resolveRuntimeAgents(this.config.agents));
  }

  private async syncRuntimeModels(_event: ModelRuntimeSync): Promise<void> {
    const runtimeModels = this.resolveRuntimeModels(this.config.models);
    this.baseCatalogModels = runtimeModels;
    this.currentCatalog = runtimeModels;
    this.updateEstimatorSelection(runtimeModels);
    this.orchestrator = this.buildOrchestrator(runtimeModels);
    this.workflowEngine = this.buildWorkflowEngine(runtimeModels);
  }

  async start(): Promise<void> {
    this.running = true;

    // Start API server if enabled
    if (this.apiServer) {
      await this.apiServer.start();
    }

    for (const sensor of this.sensors) {
      sensor.signals.subscribe((raw) => this.onSignal(raw));
      sensor.start();
    }

    while (this.running) {
      const tasks = await this.taskQueue.drain();
      if (tasks.length === 0) {
        await this.sleep(100);
        continue;
      }

      const prioritized = this.prioritizer.prioritize(tasks);
      for (const task of prioritized) {
        if (this.taskRepository) {
          await this.taskRepository.setStatus(task.id, "running");
        }
        const result = await this.executeTask(task);
        await this.deliverResult(result, task);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const sensor of this.sensors) {
      sensor.stop();
    }
    this.healthChecker.destroy();
    this.metricsCollector.destroy();
    this.budgetTracker.destroy();

    if (this.apiServer) {
      await this.apiServer.stop();
    }
  }

  async respondToHumanTask(humanTaskId: string, response: unknown): Promise<FinalResult> {
    if (!this.workflowEngine) {
      throw new Error("Workflow engine is not configured");
    }

    const result = await this.workflowEngine.resumeHumanTask(humanTaskId, response);
    const status = this.getResultStatus(result);
    if (this.taskRepository && status === "waiting_for_human") {
      await this.taskRepository.saveResult(result.taskId, result, status);
    }

    if (status === "waiting_for_human") {
      return result;
    }

    const record = await this.taskRepository?.get(result.taskId);
    if (record) {
      await this.deliverResult(result, record.task);
    }

    return result;
  }

  async submitApiTask(input: Record<string, unknown>): Promise<Task> {
    const priority = input.priority;
    const workflowId = input.workflowId;
    const workflowVersion = input.workflowVersion;
    const context = input.context;

    const task: Task = {
      id: crypto.randomUUID(),
      description: String(input.description),
      context: typeof context === "object" && context !== null
        ? structuredClone(context as Record<string, unknown>)
        : {},
      origin: {
        channel: "api",
        replyTo: typeof input.replyTo === "string" ? input.replyTo : "",
        messageId: typeof input.messageId === "string" ? input.messageId : "",
        rawPayload: structuredClone(input),
      },
      priority: priority === "critical" || priority === "high" || priority === "batch" || priority === "normal"
        ? priority
        : "normal",
      createdAt: Date.now(),
      workflow: typeof workflowId === "string" && workflowId.length > 0
        ? {
            workflowId,
            workflowVersion: typeof workflowVersion === "number" ? workflowVersion : undefined,
          }
        : undefined,
    };

    if (this.taskRepository) {
      await this.taskRepository.saveTask(task);
    }
    await this.taskQueue.enqueue(task);
    return task;
  }

  async resubmitTask(taskId: string): Promise<Task> {
    if (!this.taskRepository) {
      throw new Error("Task repository is not configured");
    }

    const record = await this.taskRepository.get(taskId);
    if (!record) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (record.status !== "failed" && record.status !== "cancelled") {
      throw new Error(`Task ${taskId} cannot be resubmitted: status is ${record.status}`);
    }

    const original = record.task;
    const context = structuredClone(original.context);
    context.resubmittedFrom = original.id;

    return this.submitApiTask({
      description: original.description,
      priority: original.priority,
      context,
      workflowId: original.workflow?.workflowId,
      workflowVersion: original.workflow?.workflowVersion,
    });
  }


  getEventBus(): EventBus {
    return this.eventBus;
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  private buildOrchestrator(catalog: ModelInfo[]): Orchestrator {
    const orchestrationCaller = this.routingCaller ?? this.defaultCaller;
    const estimator = new ComplexityEstimator(
      orchestrationCaller,
      this.defaultModel,
      this.defaultModelProvider,
    );
    const decomposer = new TaskDecomposer(
      orchestrationCaller,
      this.defaultModel,
      () => this.getRuntimeCapabilityTags(),
      this.defaultModelProvider,
    );
    const modelSelector = new ModelSelector(catalog);

    return new Orchestrator({
      estimator,
      decomposer,
      modelSelector,
      dispatcher: this.dispatcher,
      aggregator: this.aggregator,
      budgetTracker: this.budgetTracker,
      eventBus: this.eventBus,
      tracer: this.tracer,
      decompositionThreshold: this.config.complexity.decompositionThreshold,
      onConversationAppended: async (taskId, conversation) => {
        if (!this.taskRepository) {
          return;
        }
        await this.taskRepository.appendConversation(taskId, conversation);
      },
    });
  }

  private updateEstimatorSelection(catalog: ModelInfo[]): void {
    const configuredModel = this.config.complexity.estimatorModel
      ? catalog.find((model) => model.modelId === this.config.complexity.estimatorModel)
      : undefined;
    const fallbackModel = catalog.length > 0 ? catalog[0] : undefined;
    const chosenEstimator = configuredModel ?? fallbackModel;
    if (!chosenEstimator) {
      return;
    }

    this.defaultModel = chosenEstimator.modelId;
    this.defaultModelProvider = chosenEstimator.provider;

    if (!this.config.complexity.estimatorModel) {
      this.logger.info(
        `No estimator model configured; using first available model ${chosenEstimator.provider}:${chosenEstimator.modelId}`,
      );
    }
  }

  private getRuntimeCapabilityTags(): string[] {
    if (!this.tagStore) {
      return DEFAULT_CAPABILITY_TAGS.map((tag) => tag.id);
    }

    const activeTags = this.tagStore.getAllActive().map((tag) => tag.id);
    return activeTags.length > 0 ? activeTags : DEFAULT_CAPABILITY_TAGS.map((tag) => tag.id);
  }

  private ensureDefaultTagsPersisted(): void {
    if (!this.tagStore) {
      return;
    }

    for (const tag of DEFAULT_CAPABILITY_TAGS) {
      const existing = this.tagStore.get(tag.id);
      if (existing) {
        continue;
      }

      this.tagStore.save({
        id: tag.id,
        label: tag.label,
        description: tag.description,
        isActive: true,
      });
    }
  }

  private buildWorkflowEngine(catalog: ModelInfo[]): WorkflowEngine | undefined {
    if (!this.workflowRepository || !this.workflowRunRepository || !this.humanTaskRepository) {
      return undefined;
    }

    return new WorkflowEngine({
      workflowRepository: this.workflowRepository,
      workflowRunRepository: this.workflowRunRepository,
      humanTaskRepository: this.humanTaskRepository,
      artifactRepository: this.artifactRepository,
      agents: this.agents,
      modelSelector: new ModelSelector(catalog),
      budgetTracker: this.budgetTracker,
      eventBus: this.eventBus,
      tracer: this.tracer,
      onConversationAppended: async (taskId, conversation) => {
        if (!this.taskRepository) {
          return;
        }
        await this.taskRepository.appendConversation(taskId, conversation);
      },
    });
  }

  private buildHealthChecks(
    breakers: Map<Provider, CircuitBreaker>,
  ): HealthCheck[] {
    return [
      () => {
        const states = this.budgetTracker.getAllStates();
        const exhausted = states.filter((s) => s.remaining <= 0);
        return {
          name: "budget",
          ok: exhausted.length === 0,
          message:
            exhausted.length > 0
              ? `Exhausted providers: ${exhausted.map((s) => s.provider).join(", ")}`
              : undefined,
        };
      },
      () => {
        const open = [...breakers.entries()].filter(
          ([, b]) => b.getState() === "open",
        );
        return {
          name: "circuit-breakers",
          ok: open.length === 0,
          message:
            open.length > 0
              ? `Open breakers: ${open.map(([p]) => p).join(", ")}`
              : undefined,
        };
      },
      () => ({
        name: "event-bus",
        ok: true,
        message: `${this.eventBus.listenerCount("task:created")} task:created listeners`,
      }),
    ];
  }

  private buildCallers(
    models: ModelInfo[],
    secrets: SecretsProvider,
    breakers: Map<Provider, CircuitBreaker>,
  ): Map<Provider, ILLMCaller> {
    const callers = new Map<Provider, ILLMCaller>();
    const configuredProviders = this.resolveEnabledProviders(models, secrets);
    const rateLimiter = new RateLimiter({ maxPerSecond: 10, burstSize: 5 });

    const wrap = (provider: Provider, caller: ILLMCaller): ILLMCaller => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        openDurationMs: 30_000,
      });
      breakers.set(provider, breaker);
      return new ResilientLLMCaller(caller, breaker, provider, rateLimiter);
    };

    if (configuredProviders.has("openai")) {
      const key = secrets.get("OPENAI_API_KEY");
      if (!key) throw new Error("Missing OPENAI_API_KEY");
      callers.set("openai", wrap("openai", new OpenAICaller(key)));
    }

    if (configuredProviders.has("anthropic")) {
      const key = secrets.get("ANTHROPIC_API_KEY");
      if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
      callers.set("anthropic", wrap("anthropic", new AnthropicCaller(key)));
    }

    if (configuredProviders.has("ollama")) {
      callers.set(
        "ollama",
        wrap(
          "ollama",
          createOllamaCaller(
            this.resolveBaseUrl(secrets.get("OLLAMA_BASE_URL"), "http://localhost:11434/v1"),
            secrets.get("OLLAMA_API_KEY") ?? "ollama",
          ),
        ),
      );
    }

    if (configuredProviders.has("omlx")) {
      callers.set(
        "omlx",
        wrap(
          "omlx",
          createOmlxCaller(
            this.resolveBaseUrl(secrets.get("OMLX_BASE_URL"), "http://localhost:8000/v1"),
            secrets.get("OMLX_API_KEY") ?? "omlx",
          ),
        ),
      );
    }

    if (configuredProviders.has("mistral")) {
      const key = secrets.get("MISTRAL_API_KEY");
      if (!key) throw new Error("Missing MISTRAL_API_KEY");
      callers.set("mistral", wrap("mistral", createMistralCaller(key)));
    }

    if (configuredProviders.has("groq")) {
      const key = secrets.get("GROQ_API_KEY");
      if (!key) throw new Error("Missing GROQ_API_KEY");
      callers.set("groq", wrap("groq", createGroqCaller(key)));
    }

    if (configuredProviders.has("deepseek")) {
      const key = secrets.get("DEEPSEEK_API_KEY");
      if (!key) throw new Error("Missing DEEPSEEK_API_KEY");
      callers.set("deepseek", wrap("deepseek", createDeepseekCaller(key)));
    }

    if (configuredProviders.has("google")) {
      const key = secrets.get("GOOGLE_API_KEY");
      if (!key) throw new Error("Missing GOOGLE_API_KEY");
      callers.set("google", wrap("google", new GoogleCaller(key)));
    }

    return callers;
  }

  private resolveEnabledProviders(
    models: ModelInfo[],
    secrets: SecretsProvider,
  ): Set<Provider> {
    const providers = new Set<Provider>(models.map((model) => model.provider));

    if (this.hasSecret(secrets, "OPENAI_API_KEY")) {
      providers.add("openai");
    }
    if (this.hasSecret(secrets, "ANTHROPIC_API_KEY")) {
      providers.add("anthropic");
    }
    if (this.hasSecret(secrets, "GOOGLE_API_KEY")) {
      providers.add("google");
    }
    if (this.hasSecret(secrets, "MISTRAL_API_KEY")) {
      providers.add("mistral");
    }
    if (this.hasSecret(secrets, "GROQ_API_KEY")) {
      providers.add("groq");
    }
    if (this.hasSecret(secrets, "DEEPSEEK_API_KEY")) {
      providers.add("deepseek");
    }
    if (this.hasSecret(secrets, "OLLAMA_API_KEY") || this.hasSecret(secrets, "OLLAMA_BASE_URL")) {
      providers.add("ollama");
    }
    if (this.hasSecret(secrets, "OMLX_API_KEY") || this.hasSecret(secrets, "OMLX_BASE_URL")) {
      providers.add("omlx");
    }

    return providers;
  }

  private hasSecret(secrets: SecretsProvider, key: string): boolean {
    const value = secrets.get(key);
    return typeof value === "string" && value.trim().length > 0;
  }

  private resolveBaseUrl(value: string | undefined, fallback: string): string {
    return value && value.trim().length > 0 ? value.trim() : fallback;
  }

  private resolveRuntimeAgents(fallbackAgents: Required<FactoryConfig>["agents"]): Required<FactoryConfig>["agents"] {
    if (!this.agentStore) {
      return fallbackAgents;
    }

    for (const agent of fallbackAgents) {
      if (this.agentStore.get(agent.id)) {
        continue;
      }

      this.agentStore.save({
        id: agent.id,
        name: agent.id,
        tags: agent.tags,
        complexityMin: agent.complexityRange[0],
        complexityMax: agent.complexityRange[1],
        timeoutMs: agent.timeoutMs,
        maxRetries: agent.maxRetries,
        configSource: "static",
      });
    }

    const storedAgents = this.agentStore
      .getAll()
      .filter((agent) => agent.isActive)
      .map((agent) => ({
        id: agent.id,
        tags: agent.tags,
        complexityRange: [agent.complexityMin, agent.complexityMax] as [number, number],
        timeoutMs: agent.timeoutMs,
        maxRetries: agent.maxRetries,
      }));

    return storedAgents.length > 0 ? storedAgents : fallbackAgents;
  }

  private loadRuntimeAgents(runtimeAgents: Required<FactoryConfig>["agents"]): void {
    for (const manifest of this.agentRegistry.getAll()) {
      this.agentRegistry.unregister(manifest.id);
    }
    this.agents.clear();

    const caller = this.routingCaller ?? this.defaultCaller;
    for (const manifest of runtimeAgents) {
      this.agentRegistry.register(manifest);
      this.agents.set(manifest.id, this.buildConfigurableAgent(manifest, caller));
    }
  }

  private buildConfigurableAgent(
    manifest: Required<FactoryConfig>["agents"][number],
    caller: ILLMCaller,
  ): IAgent {
    const record = this.agentStore?.get(manifest.id);
    return new ConfigurableAgent(
      {
        id: manifest.id,
        name: record?.name ?? manifest.id,
        tags: record?.tags ?? manifest.tags,
        complexityMin: record?.complexityMin ?? manifest.complexityRange[0],
        complexityMax: record?.complexityMax ?? manifest.complexityRange[1],
        timeoutMs: record?.timeoutMs ?? manifest.timeoutMs,
        maxRetries: record?.maxRetries ?? manifest.maxRetries,
        description: record?.description,
        metadata: record?.metadata,
      },
      caller,
      this.tools,
    );
  }

  private resolveRuntimeModels(fallbackModels: Required<FactoryConfig>["models"]): ModelInfo[] {
    const normalizedFallbackModels = fallbackModels;
    if (!this.modelStore) {
      return normalizedFallbackModels;
    }

    for (const model of normalizedFallbackModels) {
      if (this.modelStore.get(model.provider, model.modelId)) {
        continue;
      }

      this.modelStore.save({
        provider: model.provider,
        modelId: model.modelId,
        maxTokens: model.maxTokens,
        costPer1kInput: model.costPer1kInput,
        costPer1kOutput: model.costPer1kOutput,
        capabilities: model.capabilities,
        configSource: "static",
      });
    }

    const storedModels = this.modelStore
      .getAllActive()
      .map((model) => ({
        provider: model.provider as Provider,
        modelId: model.modelId,
        maxTokens: model.maxTokens,
        costPer1kInput: model.costPer1kInput,
        costPer1kOutput: model.costPer1kOutput,
        capabilities: model.capabilities,
      }));

    return storedModels.length > 0 ? storedModels : normalizedFallbackModels;
  }

  private async onSignal(raw: {
    channel: string;
    payload: unknown;
    receivedAt: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const rawSignal = raw as import("./core/types.js").RawSignal;
    const adapter = this.adapters.get(rawSignal.channel);
    if (!adapter) {
      this.logger.warn(`No adapter for channel: ${raw.channel}`);
      return;
    }
    const signal = adapter.adapt(rawSignal);
    this.logger.info(`[Signal] ${rawSignal.channel}: ${signal.content.slice(0, 120)}`);
    const task = this.taskFactory.create(signal);
    this.logger.info(`[Task] enqueued task ${task.id} from ${task.origin.channel}`);
    if (this.taskRepository) {
      await this.taskRepository.saveTask(task);
    }
    await this.taskQueue.enqueue(task);
  }

  private async deliverResult(result: FinalResult, task: Task): Promise<void> {
    const status = this.getResultStatus(result);
    if (this.taskRepository) {
      await this.taskRepository.saveResult(result.taskId, result, status);
    }

    if (status === "waiting_for_human") {
      this.logger.info(`[Result] task ${result.taskId} is waiting for human input; skipping responder delivery`);
      return;
    }

    const responder = this.responders.get(task.origin.channel);
    if (!responder) {
      this.logger.warn(
        `No responder for channel: ${task.origin.channel}`,
      );
      return;
    }
    this.logger.info(`[Result] delivering result for task ${result.taskId} via ${task.origin.channel} (success=${result.success})`);
    await responder.respond(result, task);
  }

  private async executeTask(task: Task): Promise<FinalResult> {
    if (task.workflow && this.workflowEngine) {
      return this.workflowEngine.execute(task);
    }
    return this.orchestrator.execute(task);
  }

  private getResultStatus(result: FinalResult): import("./core/types.js").TaskExecutionStatus {
    const waitingForHuman = typeof result.output === "object"
      && result.output !== null
      && "waitingForHuman" in result.output
      && result.output.waitingForHuman === true;
    if (waitingForHuman) {
      return "waiting_for_human";
    }
    return result.success ? "completed" : "failed";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
