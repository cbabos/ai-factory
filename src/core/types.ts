// ─── Channels ────────────────────────────────────────────────

export type Channel = "email" | "slack" | "webhook" | "cron" | "filesystem" | "api";

// ─── Providers & Models ──────────────────────────────────────

export type Provider = "openai" | "anthropic" | "google" | "mistral" | "groq" | "deepseek" | "ollama" | "omlx";

export interface ModelInfo {
  provider: Provider;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: CapabilityTag[];
}

export interface DiscoveredModel {
  provider: Provider;
  modelId: string;
  ownedBy: string;
}

// ─── Capabilities ────────────────────────────────────────────

export type CapabilityTag = string;

// ─── Priority ────────────────────────────────────────────────

export type Priority = "critical" | "high" | "normal" | "batch";

// ─── Signal Layer ────────────────────────────────────────────

export interface RawSignal {
  channel: Channel;
  payload: unknown;
  receivedAt: number;
  metadata?: Record<string, unknown>;
}

export interface Signal {
  channel: Channel;
  content: string;
  receivedAt: number;
  metadata: Record<string, unknown>;
}

// ─── Task Layer ──────────────────────────────────────────────

export interface TaskOrigin {
  channel: Channel;
  replyTo: string;
  messageId: string;
  rawPayload: unknown;
}

export interface Task {
  id: string;
  description: string;
  context: Record<string, unknown>;
  origin: TaskOrigin;
  priority: Priority;
  createdAt: number;
  constraints?: TaskConstraints;
}

export interface TaskConstraints {
  maxBudget?: number;
  deadline?: number;
  requiredCapabilities?: CapabilityTag[];
  preferredProviders?: Provider[];
}

// ─── Complexity ──────────────────────────────────────────────

export interface ComplexityScore {
  score: number; // 1–10
  confidence: number; // 0–1
  reasoning: string;
  estimatedTokens: TokenEstimate;
}

export interface TokenEstimate {
  min: number;
  max: number;
  expected: number;
}

// ─── Decomposition ───────────────────────────────────────────

export interface SubTask {
  id: string;
  parentTaskId: string;
  description: string;
  context: Record<string, unknown>;
  dependencies: string[]; // IDs of sub-tasks that must complete first
  capabilityTags: CapabilityTag[];
  complexity: ComplexityScore;
  priority: Priority;
  assignedModel?: ModelChoice;
}

// ─── Model Selection ─────────────────────────────────────────

export interface ModelChoice {
  provider: Provider;
  modelId: string;
  estimatedTokens: TokenEstimate;
  estimatedCost: number;
  fallback?: ModelChoice;
}

// ─── Execution ───────────────────────────────────────────────

export interface TaskResult {
  subTaskId: string;
  output: unknown;
  success: boolean;
  error?: string;
  actualTokens: TokenUsage;
  actualCost: number;
  modelUsed: ModelChoice;
  latencyMs: number;
  retries: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface FinalResult {
  taskId: string;
  output: unknown;
  success: boolean;
  subResults: TaskResult[];
  totalTokens: TokenUsage;
  totalCost: number;
  totalLatencyMs: number;
  modelBreakdown: Record<string, TokenUsage>;
}

// ─── Budget ──────────────────────────────────────────────────

export interface BudgetState {
  provider: Provider;
  allocated: number;
  consumed: number;
  remaining: number;
  cap: number; // hard limit
  softCap: number; // warning threshold
}

// ─── Agent Manifest ──────────────────────────────────────────

export interface AgentManifest {
  id: string;
  tags: CapabilityTag[];
  complexityRange: [number, number];
  tokenProfile: TokenProfile;
  preferredModels: string[];
  timeoutMs: number;
  maxRetries: number;
}

export interface TokenProfile {
  min: number;
  max: number;
  typical: number;
}

// ─── Delivery ────────────────────────────────────────────────

export interface DeliveryReceipt {
  taskId: string;
  channel: Channel;
  deliveredAt: number;
  success: boolean;
  error?: string;
}

// ─── Events ──────────────────────────────────────────────────

export type EventType =
  | "task:created"
  | "task:decomposed"
  | "task:completed"
  | "task:failed"
  | "subtask:started"
  | "subtask:completed"
  | "subtask:failed"
  | "model:selected"
  | "model:fallback"
  | "token:consumed"
  | "budget:threshold"
  | "budget:exhausted"
  | "agent:registered"
  | "agent:unregistered";

export interface FactoryEvent {
  type: EventType;
  timestamp: number;
  payload: Record<string, unknown>;
  traceId: string;
}

// ─── Tracing ─────────────────────────────────────────────────

export interface TaskTrace {
  traceId: string;
  taskId: string;
  spans: TraceSpan[];
  startedAt: number;
  completedAt?: number;
}

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  component: string;
  action: string;
  startedAt: number;
  completedAt?: number;
  metadata: Record<string, unknown>;
}

// ─── Config ──────────────────────────────────────────────────

export interface FactoryConfig {
  complexity: {
    decompositionThreshold: number; // score above which to decompose
    estimatorModel: string;
  };
  budget: {
    defaultCap: number;
    softCapRatio: number; // e.g. 0.8 → warn at 80%
  };
  dispatch: {
    maxConcurrency: number;
    defaultTimeoutMs: number;
  };
  models: ModelInfo[];
  agents: AgentManifest[];
}
