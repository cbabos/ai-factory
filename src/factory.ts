import type {
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
} from "./core/index.js";
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
  SearchAgent,
  AnalysisAgent,
  SummarizerAgent,
  ExecutorAgent,
  FileIOAgent,
} from "./agents/index.js";
import type { IToolRegistry } from "./tools/interfaces.js";
import type { ITaskRepository } from "./core/task-repository.js";
import type { SecretsProvider } from "./core/secrets.js";
import { SQLiteAgentStore } from "./core/agent-store.js";
import { SQLiteModelStore } from "./core/model-store.js";
import { SQLiteConfigStore } from "./core/sqlite-config-store.js";
import { ApiServer } from "./core/api-server.js";
import { setSettingsStore as setupSettingsStore } from "./core/api-handlers/settings.js";

export interface AIFactoryOptions {
  config: FactoryConfig;
  secrets: SecretsProvider;
  callers?: Map<Provider, ILLMCaller>;
  logger?: ILogger;
  repository?: IRepository<{ id: string }>;
  taskRepository?: ITaskRepository;
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

  private config: FactoryConfig;
  private callers: Map<Provider, ILLMCaller>;
  private breakers = new Map<Provider, CircuitBreaker>();
  private defaultModel: string;
  private defaultCaller: ILLMCaller;
  private dispatcher: Dispatcher;
  private aggregator: Aggregator;
  private tools?: IToolRegistry;

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
    const { config, secrets, callers: injectedCallers, logger, repository, taskRepository, tools, apiServerOptions } = options;

    this.config = config;
    this.logger = logger ?? new ConsoleLogger({ namespace: "AIFactory", level: "info" });
    this.repository = repository as IRepository<{ id: string }> | undefined;
    this.taskRepository = taskRepository;
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
    for (const manifest of runtimeAgents) {
      this.agentRegistry.register(manifest);
    }

    this.metricsCollector = new MetricsCollector(this.eventBus);

    this.callers = injectedCallers ?? this.buildCallers(runtimeModels, secrets, this.breakers);
    const defaultCaller = this.callers.values().next().value;
    if (!defaultCaller) {
      throw new Error("No LLM callers configured");
    }
    this.defaultCaller = defaultCaller;
    this.defaultModel = config.complexity.estimatorModel ?? "";

    // `agents` and `dispatcher` are rebuilt after initialize() discovers which
    // models are actually available, so the runtime can fall back to the first
    // available model when the config does not name one.
    const agents = this.buildAgents(defaultCaller, this.tools);
    this.dispatcher = new Dispatcher(
      this.agentRegistry,
      agents,
      config.dispatch.maxConcurrency,
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
        this.agentRegistry,
        undefined,
        this.tracer,
        this.budgetTracker,
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
        const result = await this.orchestrator.execute(task);
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

  private buildAgents(
    caller: ILLMCaller,
    tools?: IToolRegistry,
  ): Map<string, import("./core/interfaces.js").IAgent> {
    const agents = new Map<string, import("./core/interfaces.js").IAgent>();
    const instances = [
      new SearchAgent(caller, tools),
      new AnalysisAgent(caller, tools),
      new SummarizerAgent(caller, tools),
      new ExecutorAgent(caller, tools),
      new FileIOAgent(caller, tools),
    ];

    for (const agent of instances) {
      agents.set(agent.manifest.id, agent);
    }

    return agents;
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
    const responder = this.responders.get(task.origin.channel);
    if (!responder) {
      this.logger.warn(
        `No responder for channel: ${task.origin.channel}`,
      );
      return;
    }
    this.logger.info(`[Result] delivering result for task ${result.taskId} via ${task.origin.channel} (success=${result.success})`);
    if (this.taskRepository) {
      await this.taskRepository.saveResult(result.taskId, result, result.success ? "completed" : "failed", result.conversation);
    }
    await responder.respond(result, task);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
