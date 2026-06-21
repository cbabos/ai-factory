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
import type { SecretsProvider } from "./core/secrets.js";

export interface AIFactoryOptions {
  config: FactoryConfig;
  secrets: SecretsProvider;
  callers?: Map<Provider, ILLMCaller>;
  logger?: ILogger;
  repository?: IRepository<{ id: string }>;
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

  private config: FactoryConfig;
  private callers: Map<Provider, ILLMCaller>;
  private breakers = new Map<Provider, CircuitBreaker>();
  private defaultModel: string;
  private defaultCaller: ILLMCaller;
  private dispatcher: Dispatcher;
  private aggregator: Aggregator;

  private sensors: ISensor[] = [];
  private adapters = new Map<string, ISignalAdapter>();
  private responders = new Map<string, IResponder>();
  private running = false;

  constructor(options: AIFactoryOptions) {
    const { config, secrets, callers: injectedCallers, logger, repository } = options;

    this.config = config;
    this.logger = logger ?? new ConsoleLogger({ namespace: "AIFactory", level: "info" });
    this.repository = repository as IRepository<{ id: string }> | undefined;
    this.eventBus = new EventBus(new NoopLogger());
    this.tracer = new Tracer();

    this.budgetTracker = new BudgetTracker(this.eventBus);
    this.budgetTracker.loadConfig({
      defaultCap: config.budget.defaultCap,
      softCapRatio: config.budget.softCapRatio,
    });
    const providers = [...new Set(config.models.map((m) => m.provider))];
    this.budgetTracker.initialize(providers);

    this.agentRegistry = new AgentRegistry(this.eventBus);
    for (const manifest of config.agents) {
      this.agentRegistry.register(manifest);
    }

    this.metricsCollector = new MetricsCollector(this.eventBus);

    this.callers = injectedCallers ?? this.buildCallers(config, secrets, this.breakers);
    const defaultCaller = this.callers.values().next().value;
    if (!defaultCaller) {
      throw new Error("No LLM callers configured");
    }
    this.defaultCaller = defaultCaller;
    this.defaultModel = config.complexity.estimatorModel;

    this.healthChecker = new HealthChecker(
      this.buildHealthChecks(this.breakers),
      30_000,
    );

    const agents = this.buildAgents(defaultCaller);
    this.dispatcher = new Dispatcher(
      this.agentRegistry,
      agents,
      config.dispatch.maxConcurrency,
    );
    this.aggregator = new Aggregator();

    this.taskFactory = new TaskFactory();
    this.prioritizer = new Prioritizer();
    this.taskQueue = new InMemoryTaskQueue();

    this.orchestrator = this.buildOrchestrator(config.models);
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

  async initialize(): Promise<void> {
    const catalog = new ModelCatalog(
      [...this.callers.values()],
      this.config.models,
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
      this.logger.info(`Discovered ${discovered.length} model(s): ${discovered.map((m) => `${m.provider}:${m.modelId}`).join(", ") || "none"}`);
    } catch (err) {
      this.logger.warn(
        "Model discovery failed, falling back to static catalog:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const preferred = discovered.find(
      (m) => m.provider === "omlx" && /qwen/i.test(m.modelId),
    ) ?? discovered.find((m) => /qwen/i.test(m.modelId));

    if (preferred) {
      this.defaultModel = preferred.modelId;
      this.logger.info(`Selected default model: ${preferred.provider}:${preferred.modelId}`);
    } else {
      this.logger.info(`Using configured default model: ${this.defaultModel}`);
    }

    const mergedCatalog = this.buildMergedCatalog(discovered);
    this.orchestrator = this.buildOrchestrator(mergedCatalog);
  }

  async start(): Promise<void> {
    this.running = true;

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
      this.config.models.map((m) => [`${m.provider}:${m.modelId}`, m]),
    );
    const merged = new Map<string, ModelInfo>(staticByKey);

    for (const d of discovered) {
      const key = `${d.provider}:${d.modelId}`;
      if (merged.has(key)) continue;
      merged.set(key, {
        provider: d.provider as Provider,
        modelId: d.modelId,
        maxTokens: 4096,
        costPer1kInput: 0,
        costPer1kOutput: 0,
        capabilities: ["search", "analysis", "summarization", "execution", "code-generation", "file-io", "read-only", "write", "reasoning", "synthesis"],
      });
    }

    return [...merged.values()];
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
    config: FactoryConfig,
    secrets: SecretsProvider,
    breakers: Map<Provider, CircuitBreaker>,
  ): Map<Provider, ILLMCaller> {
    const callers = new Map<Provider, ILLMCaller>();
    const configuredProviders = new Set(config.models.map((m) => m.provider));
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

  private buildAgents(caller: ILLMCaller): Map<string, import("./core/interfaces.js").IAgent> {
    const agents = new Map<string, import("./core/interfaces.js").IAgent>();
    const instances = [
      new SearchAgent(caller),
      new AnalysisAgent(caller),
      new SummarizerAgent(caller),
      new ExecutorAgent(caller),
      new FileIOAgent(caller),
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
    this.logger.info();
    const task = this.taskFactory.create(signal);
    this.logger.info();
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
    await responder.respond(result, task);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
