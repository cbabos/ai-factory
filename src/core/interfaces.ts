import type {
  AgentManifest,
  BudgetState,
  ComplexityScore,
  ConversationTurn,
  DeliveryReceipt,
  DiscoveredModel,
  FactoryConfig,
  FactoryEvent,
  FinalResult,
  ModelChoice,
  RawSignal,
  Signal,
  SubTask,
  Task,
  TaskResult,
  TaskTrace,
  TokenUsage,
  TraceSpan,
  Provider,
} from "./types.js";

// ─── Observable (for sensors) ────────────────────────────────

export interface Subscription {
  unsubscribe(): void;
}

export interface IObservable<T> {
  subscribe(handler: (value: T) => void | Promise<void>): Subscription;
}

// ─── Sensor ──────────────────────────────────────────────────

export interface ISensor {
  readonly channel: string;
  start(): void;
  stop(): void;
  readonly signals: IObservable<RawSignal>;
}

// ─── Signal Adapter ──────────────────────────────────────────

export interface ISignalAdapter {
  readonly channel: string;
  adapt(raw: RawSignal): Signal;
}

// ─── Task Factory ─────────────────────────────────────────────

export interface ITaskFactory {
  create(signal: Signal): Task;
}

// ─── Prioritizer ─────────────────────────────────────────────

export interface IPrioritizer {
  prioritize(tasks: Task[]): Task[];
}

// ─── Complexity Estimator ────────────────────────────────────

export interface EstimationResult {
  score: ComplexityScore;
  conversation: ConversationTurn[];
}

export type IComplexityEstimator = IPipelineStep<Task, EstimationResult>;

// ─── Task Decomposer ─────────────────────────────────────────

export interface DecompositionResult {
  subTasks: SubTask[];
  conversation: ConversationTurn[];
}

export interface ITaskDecomposer {
  decompose(task: Task, score: ComplexityScore): Promise<DecompositionResult>;
}

// ─── Model Selector ──────────────────────────────────────────

export interface IModelSelector {
  select(subTask: SubTask, budget: BudgetState[]): Promise<ModelChoice>;
}

// ─── Dispatcher ───────────────────────────────────────────────

export type IDispatcher = IPipelineStep<SubTask[], TaskResult[]>;

// ─── Agent ────────────────────────────────────────────────────

export interface IAgent extends IPipelineStep<SubTask, TaskResult> {
  readonly manifest: AgentManifest;
}

// ─── Aggregator ──────────────────────────────────────────────

export interface IAggregator {
  aggregate(task: Task, results: TaskResult[]): FinalResult;
}

// ─── Responder ────────────────────────────────────────────────

export interface IResponder {
  readonly channel: string;
  respond(result: FinalResult, task: Task): Promise<DeliveryReceipt>;
}

// ─── Budget Tracker ──────────────────────────────────────────

export interface IBudgetTracker {
  getState(provider: string): BudgetState;
  getAllStates(): BudgetState[];
  canAfford(provider: string, estimatedTokens: number, estimatedCost: number): boolean;
  recordUsage(provider: string, usage: TokenUsage, cost: number): void;
  reset(provider: string): void;
}

// ─── Agent Registry ──────────────────────────────────────────

export interface IAgentRegistry {
  register(manifest: AgentManifest): void;
  unregister(agentId: string): void;
  get(agentId: string): AgentManifest | undefined;
  findByTags(tags: string[]): AgentManifest[];
  findByComplexity(score: number): AgentManifest[];
  getAll(): AgentManifest[];
}

// ─── Orchestrator ────────────────────────────────────────────

export type IOrchestrator = IPipelineStep<Task, FinalResult>;

// ─── Event Bus ────────────────────────────────────────────────

export interface IEventBus {
  emit(event: FactoryEvent): void;
  on(type: string, handler: (event: FactoryEvent) => void | Promise<void>): Subscription;
  off(type: string, handler: (event: FactoryEvent) => void | Promise<void>): void;
}

// ─── Repository ──────────────────────────────────────────────

export interface IRepository<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;
  query(predicate: (item: T) => boolean): Promise<T[]>;
}

// ─── LLM Caller ──────────────────────────────────────────────

export interface LLMCallOptions {
  model: string;
  provider: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  stopSequences?: string[];
}

export interface LLMCallResult {
  content: string;
  usage: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface ILLMCaller {
  readonly provider: Provider;
  call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult>;
  callStructured<T>(prompt: string, options: LLMCallOptions, schema: object): Promise<T>;
  estimateTokens(prompt: string, model: string): number;
  listModels(): Promise<DiscoveredModel[]>;
}

// ─── Configurable ─────────────────────────────────────────────

export interface IConfigurable<TConfig = FactoryConfig> {
  readonly config: TConfig;
  loadConfig(config: TConfig): void;
  validateConfig(config: TConfig): string[];
}

// ─── Tracer ──────────────────────────────────────────────────

export interface ITracer {
  startTrace(taskId: string): TaskTrace;
  startSpan(traceId: string, component: string, action: string, parentSpanId?: string): TraceSpan;
  endSpan(span: TraceSpan, metadata?: Record<string, unknown>): void;
  endTrace(trace: TaskTrace): void;
  getTrace(traceId: string): TaskTrace | undefined;
}

// ─── Pipeline Step (the universal building block) ────────────

export interface IPipelineStep<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput): Promise<TOutput>;
  validate?(input: TInput): string[];
}
