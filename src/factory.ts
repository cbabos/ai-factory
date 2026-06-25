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
import {
  ConfigurableAgent,
  SearchAgent,
  AnalysisAgent,
  SummarizerAgent,
  ExecutorAgent,
  FileIOAgent,
} from "./agents/index.js";
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
import { SQLiteConfigStore } from "./core/sqlite-config-store.js";
import { ApiServer } from "./core/api-server.js";
import { setSettingsStore as setupSettingsStore } from "./core/api-handlers/settings.js";
import type { AgentRecord, CreateAgentInput } from "./core/agent-store.js";
import type { AgentRuntimeSync } from "./core/api-types.js";

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

  private config: FactoryConfig;
  private callers: Map<Provider, ILLMCaller>;
  private breakers = new Map<Provider, CircuitBreaker>();
  private defaultModel: string;
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
  private baseCatalogModels: ModelInfo[];

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

    this.config = config;
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
    }

    const runtimeModels = this.resolveRuntimeModels(config.models);
    const runtimeAgents = this.resolveRuntimeAgents(config.agents);
    this.baseCatalogModels = runtimeModels;

    this.budgetTracker = new BudgetTracker(this.eventBus);
    this.budgetTracker.loadConfig({
      defaultCap: config.budget.defaultCap,
      softCapRatio: config.budget.softCapRatio,
    });
    const providers = [...new Set(runtimeModels.map((m) => m.provider))];
    this.budgetTracker.initialize(providers);

    this.agentRegistry = new AgentRegistry(this.eventBus);

    this.metricsCollector = new MetricsCollector(this.eventBus);

    this.callers = injectedCallers ?? this.buildCallers(runtimeModels, secrets, this.breakers);
    const defaultCaller = this.callers.values().next().value;
    if (!defaultCaller) {
      throw new Error("No LLM callers configured");
    }
    this.defaultCaller = defaultCaller;
    this.routingCaller = new RoutingLLMCaller(this.callers);
    this.defaultModel = config.complexity.estimatorModel ?? "";

    // `agents` and `dispatcher` are rebuilt after initialize() discovers which
    // models are actually available, so the runtime can fall back to the first
    // available model when the config does not name one.
    this.agents = new Map<string, IAgent>();
    this.loadRuntimeAgents(runtimeAgents);
    this.dispatcher = new Dispatcher(
      this.agentRegistry,
      this.agents,
      config.dispatch.maxConcurrency,
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
    if (this.apiServer) {
      await this.apiServer.initialize(
        this.agentStore,
        this.modelStore,
        this.taskRepository,
        this.workflowRepository,
        this.workflowRunRepository,
        this.humanTaskRepository,
        this.artifactRepository,
        this.agentRegistry,
        undefined,
        this.tracer,
        this.budgetTracker,
        async (humanTaskId, response) => this.respondToHumanTask(humanTaskId, response),
        async (input) => this.submitApiTask(input),
        (event) => this.syncRuntimeAgents(event),
      );
    }

    const runtimeModels = this.resolveRuntimeModels(this.config.models);
    this.baseCatalogModels = runtimeModels;

    const catalog = new ModelCatalog(
      [...this.callers.values()],
      runtimeModels,
      this.logger,
    );

    let discovered: { provider: string; modelId: string; ownedBy?: string }[] = [];
    try {
      const entries = await catalog.discoverAll();
      discovered = entries.map((e) => ({
        provider: e.discovered.provider,
        modelId: e.discovered.modelId,
        ownedBy: e.discovered.ownedBy,
      }));
      this.persistDiscoveredModels(discovered);
      this.logger.info(`Discovered ${discovered.length} model(s): ${discovered.map((m) => `${m.provider}:${m.modelId}`).join(", ") || "none"}`);
    } catch (err) {
      this.logger.warn(
        "Model discovery failed, falling back to static catalog:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const mergedCatalog = this.buildMergedCatalog(discovered);
    const configuredModel = this.config.complexity.estimatorModel
      ? mergedCatalog.find((m) => m.modelId === this.config.complexity.estimatorModel)
      : undefined;
    const fallbackModel = mergedCatalog.length > 0 ? mergedCatalog[0]! : undefined;
    const chosenEstimator = configuredModel ?? fallbackModel;
    if (chosenEstimator) {
      this.defaultModel = chosenEstimator.modelId;
      if (!this.config.complexity.estimatorModel) {
        this.logger.info(`No estimator model configured; using first available model ${chosenEstimator.provider}:${chosenEstimator.modelId}`);
      }
    }

    this.orchestrator = this.buildOrchestrator(mergedCatalog);
    this.workflowEngine = this.buildWorkflowEngine(mergedCatalog);
  }

  private syncRuntimeAgents(_event: AgentRuntimeSync): void {
    if (this.agentStore) {
      const runtimeAgents = this.resolveRuntimeAgents(this.config.agents);
      this.loadRuntimeAgents(runtimeAgents);
      return;
    }

    this.loadRuntimeAgents(this.resolveRuntimeAgents(this.config.agents));
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

  private buildMergedCatalog(
    discovered: { provider: string; modelId: string; ownedBy?: string }[],
  ): ModelInfo[] {
    const staticByKey = new Map(
      this.baseCatalogModels.map((m) => [`${m.provider}:${m.modelId}`, m]),
    );

    // Static config defines authoritative capabilities, cost, and priority.
    // Preserve that order first.
    const ordered: ModelInfo[] = [...this.baseCatalogModels];
    const added = new Set<string>(staticByKey.keys());

    // Append genuinely new discovered models at the end with conservative
    // defaults so they do not accidentally outrank configured models.
    for (const d of discovered) {
      const key = `${d.provider}:${d.modelId}`;
      if (added.has(key)) continue;
      added.add(key);
      ordered.push({
        provider: d.provider as Provider,
        modelId: d.modelId,
        maxTokens: 4096,
        costPer1kInput: 0.001,
        costPer1kOutput: 0.001,
        capabilities: ["analysis"],
      });
    }

    return ordered;
  }

  private buildOrchestrator(catalog: ModelInfo[]): Orchestrator {
    const estimator = new ComplexityEstimator(this.defaultCaller, this.defaultModel);
    const decomposer = new TaskDecomposer(this.defaultCaller, this.defaultModel);
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
    const configuredProviders = new Set(models.map((m) => m.provider));
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
      callers.set("ollama", wrap("ollama", createOllamaCaller(undefined, secrets.get("OLLAMA_API_KEY") ?? "ollama")));
    }

    if (configuredProviders.has("omlx")) {
      callers.set("omlx", wrap("omlx", createOmlxCaller(undefined, secrets.get("OMLX_API_KEY") ?? "omlx")));
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

  private resolveRuntimeAgents(fallbackAgents: FactoryConfig["agents"]): FactoryConfig["agents"] {
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
        tokenProfileMin: agent.tokenProfile.min,
        tokenProfileMax: agent.tokenProfile.max,
        tokenProfileTypical: agent.tokenProfile.typical,
        preferredModels: agent.preferredModels,
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
        tokenProfile: {
          min: agent.tokenProfile.min,
          max: agent.tokenProfile.max,
          typical: agent.tokenProfile.typical,
        },
        preferredModels: agent.preferredModels,
        timeoutMs: agent.timeoutMs,
        maxRetries: agent.maxRetries,
      }));

    return storedAgents.length > 0 ? storedAgents : fallbackAgents;
  }

  private loadRuntimeAgents(runtimeAgents: FactoryConfig["agents"]): void {
    for (const manifest of this.agentRegistry.getAll()) {
      this.agentRegistry.unregister(manifest.id);
    }
    this.agents.clear();

    for (const manifest of runtimeAgents) {
      this.agentRegistry.register(manifest);
      const configuredAgent = this.buildConfigurableAgentFromStore(manifest.id);
      const executable = configuredAgent ?? this.buildBuiltinAgent(manifest.id, this.routingCaller ?? this.defaultCaller, this.tools);
      if (executable) {
        this.agents.set(manifest.id, executable);
      }
    }
  }

  private buildConfigurableAgentFromStore(agentId: string): IAgent | undefined {
    if (!this.agentStore || !this.routingCaller) {
      return undefined;
    }

    const record = this.agentStore.get(agentId);
    if (!record || !record.isActive) {
      return undefined;
    }

    if (this.isBuiltinAgentId(agentId)) {
      return undefined;
    }

    return new ConfigurableAgent(
      this.agentRecordToCreateInput(record),
      this.routingCaller,
      this.tools,
    );
  }

  private agentRecordToCreateInput(record: AgentRecord): CreateAgentInput & { description?: string; metadata?: Record<string, unknown> } {
    return {
      id: record.id,
      name: record.name,
      tags: record.tags,
      complexityMin: record.complexityMin,
      complexityMax: record.complexityMax,
      tokenProfileMin: record.tokenProfile.min,
      tokenProfileMax: record.tokenProfile.max,
      tokenProfileTypical: record.tokenProfile.typical,
      preferredModels: record.preferredModels,
      timeoutMs: record.timeoutMs,
      maxRetries: record.maxRetries,
      configSource: record.configSource,
      description: record.description,
      metadata: record.metadata,
    };
  }

  private isBuiltinAgentId(agentId: string): boolean {
    return agentId === "search-agent"
      || agentId === "analysis-agent"
      || agentId === "summarizer-agent"
      || agentId === "executor-agent"
      || agentId === "file-io-agent";
  }

  private buildBuiltinAgent(
    agentId: string,
    caller: ILLMCaller,
    tools?: IToolRegistry,
  ): IAgent | undefined {
    switch (agentId) {
      case "search-agent":
        return new SearchAgent(caller, tools);
      case "analysis-agent":
        return new AnalysisAgent(caller, tools);
      case "summarizer-agent":
        return new SummarizerAgent(caller, tools);
      case "executor-agent":
        return new ExecutorAgent(caller, tools);
      case "file-io-agent":
        return new FileIOAgent(caller, tools);
      default:
        return undefined;
    }
  }

  private resolveRuntimeModels(fallbackModels: FactoryConfig["models"]): ModelInfo[] {
    if (!this.modelStore) {
      return fallbackModels;
    }

    for (const model of fallbackModels) {
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

    return storedModels.length > 0 ? storedModels : fallbackModels;
  }

  private persistDiscoveredModels(
    discovered: { provider: string; modelId: string; ownedBy?: string }[],
  ): void {
    if (!this.modelStore) {
      return;
    }

    const discoveredAt = Date.now();

    for (const model of discovered) {
      if (this.modelStore.get(model.provider, model.modelId)) {
        continue;
      }

      this.modelStore.save({
        provider: model.provider,
        modelId: model.modelId,
        maxTokens: 4096,
        costPer1kInput: 0.001,
        costPer1kOutput: 0.001,
        capabilities: ["analysis"],
        ownedBy: model.ownedBy,
        configSource: "discovered",
        discoveredAt,
      });
    }
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
