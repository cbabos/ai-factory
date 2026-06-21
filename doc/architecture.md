# AI Factory — Core Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [The Two Orthogonal Axes](#the-two-orthogonal-axes)
3. [Complete Workflow: Sensor → Delivery](#complete-workflow-sensor--delivery)
4. [The Base Classes](#the-base-classes)
5. [Microservices Equivalents](#microservices-equivalents)
6. [All Data Types](#all-data-types)
7. [All Interfaces](#all-interfaces)
8. [File-by-File Breakdown](#file-by-file-breakdown)
9. [Key Design Decisions](#key-design-decisions)

---

## System Overview

The AI Factory is a system that receives signals from external sources (email, Slack, webhooks, cron, filesystem), processes them through a pipeline of small, single-responsibility AI agents, and delivers results back to the originating channel.

The core insight: **every component is a `PipelineStep<TInput, TOutput>`**. The Orchestrator composes them into a DAG. Agents are just specialized PipelineSteps that own an LLM caller.

```
┌──────────────────── INBOUND ────────────────────┐  ┌────────── CORE ──────────┐  ┌────── OUTBOUND ──────┐
│                                                  │  │                         │  │                      │
│  Sensor → Adapter → Factory → Queue → Prioritize │→│  Orchestrator → Agents   │→│  Responder → Channel  │
│                                                  │  │                         │  │                      │
│  "Capture & normalize"                           │  │  "Think & do"            │  │  "Format & deliver"   │
└──────────────────────────────────────────────────┘  └─────────────────────────┘  └──────────────────────┘
```

### Orchestrator Internals

```
Task arrives
     │
     ▼
┌─────────────────┐
│ Complexity       │  Scores task 1–10. If score > threshold, triggers decomposition.
│ Estimator        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task             │  Splits high-complexity tasks into a DAG of SubTasks.
│ Decomposer       │  Each SubTask gets its own complexity score and capability tags.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Model            │  For each SubTask: queries Budget Tracker, picks cheapest model
│ Selector         │  that can handle the complexity. Assigns model to SubTask.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Dispatcher       │  Fans out SubTasks to matching agents. Respects DAG dependencies
│                  │  (parallel where possible, sequential where required).
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Pool       │  Many tiny agents. Each declares: capability tags, complexity
│                  │  range, token profile, preferred models. Stateless.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Aggregator       │  Merges SubTask results into a coherent FinalResult.
└────────┬────────┘
         │
         ▼
    FinalResult
```

### Cross-Cutting Concerns

Three systems run orthogonal to the pipeline:

- **EventBus** — Every component emits events (`task:created`, `subtask:completed`, `token:consumed`, `budget:exhausted`, `model:fallback`, etc.). The Budget Tracker and metrics collectors are pure subscribers.
- **Tracer** — Every component creates spans. A full trace shows the decomposition tree, model choices, token usage, and latency per span.
- **Budget Tracker** — Real-time token ledger per provider. Enforces hard/soft caps. Model Selector queries it before assigning models.

---

## The Two Orthogonal Axes

The system splits cleanly along two dimensions:

```
                    STATIC / DECLARATIVE          DYNAMIC / OPERATIONAL
                    ─────────────────────         ─────────────────────
                    AgentManifest                 PipelineStep.execute()
                    FactoryConfig                 EventBus.emit()
                    Repository schema             BudgetTracker.recordUsage()
                    Capability tags               LLMCaller.call()
                    ModelInfo                     Tracer.startSpan()
```

**Static side**: manifests, configs, schemas — defines *what exists* and *what's allowed*. Loaded at startup, validated, stored in repositories.

**Dynamic side**: pipeline execution, events, budget tracking, tracing — the *runtime behavior*. Flows through `PipelineContext` (eventBus + tracer + traceId).

---

## Complete Workflow: Sensor → Delivery

### Step 1: Signal Capture

A **Sensor** detects an external event. One sensor per channel:

| Sensor | Channel | How it works |
|--------|---------|-------------|
| EmailSensor | `email` | Polls IMAP, emits `RawSignal` per new email |
| SlackSensor | `slack` | Listens to Slack Events API |
| WebhookSensor | `webhook` | HTTP endpoint, emits per POST |
| CronSensor | `cron` | Timer-based, emits on schedule |
| FileWatcherSensor | `filesystem` | `fs.watch`, emits on file change |

Each sensor implements `ISensor`:
```typescript
interface ISensor {
  readonly channel: string;
  start(): void;
  stop(): void;
  readonly signals: IObservable<RawSignal>;
}
```

Sensors emit `RawSignal` objects into an observable stream:
```typescript
interface RawSignal {
  channel: Channel;        // "email" | "slack" | "webhook" | "cron" | "filesystem" | "api"
  payload: unknown;        // raw, channel-specific data (email body, Slack JSON, etc.)
  receivedAt: number;      // epoch ms
  metadata?: Record<string, unknown>;
}
```

### Step 2: Signal Normalization

A **SignalAdapter** (one per channel) converts the raw, channel-specific payload into a normalized `Signal`:

```typescript
interface Signal {
  channel: Channel;
  content: string;         // normalized text — the actual message/request
  receivedAt: number;
  metadata: Record<string, unknown>;
}
```

The adapter strips channel-specific wrappers (email headers, Slack formatting, webhook envelopes) and extracts the core content. The `metadata` field preserves any useful context (sender, thread ID, attachments).

### Step 3: Task Creation

The **TaskFactory** enriches the `Signal` into a `Task`. It adds:

- A unique `id`
- `context` — user history, project state, previous interactions (loaded from repositories)
- `origin` — preserves the channel, reply address, and raw payload for the Responder later
- `priority` — derived from signal metadata (e.g., VIP sender → `critical`)
- `constraints` — optional budget caps, deadlines, required capabilities

```typescript
interface Task {
  id: string;
  description: string;
  context: Record<string, unknown>;
  origin: TaskOrigin;       // flows untouched through entire pipeline
  priority: Priority;       // "critical" | "high" | "normal" | "batch"
  createdAt: number;
  constraints?: TaskConstraints;
}

interface TaskOrigin {
  channel: Channel;
  replyTo: string;          // email address, channel ID, callback URL
  messageId: string;        // for threading
  rawPayload: unknown;      // preserved for Responder formatting
}
```

**Key design**: `Task.origin` is never read by the Orchestrator or Agents. It flows through untouched. Only the Responder consumes it at the very end to know where and how to deliver the result.

### Step 4: Buffering & Prioritization

Tasks enter a **TaskQueue** (persistent buffer for handling spikes). A **Prioritizer** reorders the queue by urgency, SLA, and dependency constraints.

### Step 5: Orchestration

The **Orchestrator** (`IOrchestrator.process(task) → FinalResult`) runs the core pipeline:

1. **ComplexityEstimator** scores the task (1–10) with confidence and token estimates
2. If score > `decompositionThreshold` → **TaskDecomposer** splits into `SubTask[]` DAG
3. For each SubTask → **ModelSelector** picks cheapest capable model, respecting budget caps
4. **Dispatcher** fans out to agents (parallel where DAG allows, respecting `dependencies[]`)
5. **Aggregator** merges `TaskResult[]` into `FinalResult`

### Step 6: Agent Execution

Each **Agent** receives a `SubTask` (with `assignedModel` already set by the Selector):

1. Reads `subTask.assignedModel` for provider/model
2. Calls `buildPrompt(subTask)` and `buildSystemPrompt(subTask)` — agent-specific
3. Calls `llmCaller.call(prompt, options)`
4. Calls `parseOutput(raw, subTask)` — agent-specific output parsing
5. On failure: retries up to `manifest.maxRetries`, falls back to `model.fallback` if available
6. Emits `subtask:completed` or `subtask:failed` + `model:fallback` events
7. Returns `TaskResult` with actual token usage, cost, latency

### Step 7: Aggregation

The **Aggregator** takes the original `Task` + all `TaskResult[]` and produces a `FinalResult`:

```typescript
interface FinalResult {
  taskId: string;
  output: unknown;              // merged, coherent result
  success: boolean;
  subResults: TaskResult[];     // all individual agent outputs
  totalTokens: TokenUsage;      // sum across all agents
  totalCost: number;            // sum across all agents
  totalLatencyMs: number;       // end-to-end wall clock
  modelBreakdown: Record<string, TokenUsage>;  // per-model token accounting
}
```

### Step 8: Delivery

The **Responder** (one per channel) takes the `FinalResult` + `Task.origin` and delivers:

- Email → formats and sends reply email to `origin.replyTo`
- Slack → posts message to `origin.replyTo` channel, threads on `origin.messageId`
- Webhook → HTTP POST to `origin.replyTo` callback URL
- Cron → writes to file, database, or triggers next job

Returns a `DeliveryReceipt`:
```typescript
interface DeliveryReceipt {
  taskId: string;
  channel: Channel;
  deliveredAt: number;
  success: boolean;
  error?: string;
}
```

---

## The Base Classes

The system has 10 base classes. Six are abstract foundations; four are concrete implementations that compose them.

### Abstract Foundations

### 1. `Configurable<TConfig>` (`configurable.ts`)

**Purpose**: Every component loads and validates configuration.

```
Configurable<TConfig = FactoryConfig>
  ├── config: TConfig           (read-only, set via loadConfig)
  ├── loadConfig(config): void  (validates then stores)
  └── validateConfig(config): string[]  (abstract — returns error messages)
```

Used by: all components. The `FactoryConfig` is the root config type containing complexity thresholds, budget caps, dispatch settings, model catalog, and agent manifests.

### 2. `EventBus` (`event-bus.ts`)

**Purpose**: The nervous system. Decouples components via typed pub/sub.

```
EventBus implements IEventBus
  ├── emit(event: FactoryEvent): void        (fire-and-forget, errors isolated)
  ├── on(type, handler): Subscription        (subscribe to event type)
  ├── off(type, handler): void               (unsubscribe)
  └── listenerCount(type): number            (debug/inspection)
```

Events carry a `traceId` so all events for one task are correlated. Handlers can be sync or async; errors in one handler don't crash others.

**14 event types**:
- Lifecycle: `task:created`, `task:decomposed`, `task:completed`, `task:failed`
- Execution: `subtask:started`, `subtask:completed`, `subtask:failed`
- Model: `model:selected`, `model:fallback`
- Budget: `token:consumed`, `budget:threshold`, `budget:exhausted`
- Registry: `agent:registered`, `agent:unregistered`

### 3. `LLMCaller` (`llm-caller.ts`)

**Purpose**: Abstract base for calling LLM providers. One concrete implementation per provider (OpenAI, Anthropic, etc.).

```
LLMCaller implements ILLMCaller
  ├── call(prompt, options): LLMCallResult           (abstract — provider-specific)
  ├── callStructured<T>(prompt, options, schema): T  (calls call() with JSON format, parses)
  ├── estimateTokens(prompt, model): number           (abstract — provider-specific)
  └── buildUsage(input, output): TokenUsage          (protected helper)
```

`LLMCallOptions`:
```typescript
{
  model: string;
  provider: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  stopSequences?: string[];
}
```

`LLMCallResult`:
```typescript
{
  content: string;
  usage: TokenUsage;       // { input, output, total }
  model: string;
  provider: string;
  latencyMs: number;
}
```

### 4. `InMemoryRepository<T>` (`repository.ts`)

**Purpose**: Generic persistence for any entity with an `id`. In-memory implementation; swappable for DB-backed later.

```
InMemoryRepository<T extends { id: string }> implements IRepository<T>
  ├── get(id): T | undefined
  ├── getAll(): T[]
  ├── save(item): void          (structuredClone for immutability)
  ├── delete(id): void
  └── query(predicate): T[]     (in-memory filter)
```

Used for: Agent manifests, budget state, task history, model performance stats, traces.

### 5. `PipelineStep<TInput, TOutput>` (`pipeline-step.ts`)

**Purpose**: The universal building block. Every processing component is one.

```
PipelineStep<TInput, TOutput> implements IPipelineStep<TInput, TOutput>
  ├── name: string                        (abstract — e.g. "ComplexityEstimator")
  ├── ctx?: PipelineContext               (injected via setContext)
  ├── execute(input: TInput): TOutput    (abstract — the actual work)
  ├── validate?(input: TInput): string[]  (optional input validation)
  ├── emit(type, payload): void          (protected — emits event with traceId)
  ├── startSpan(action, parentSpanId?): TraceSpan  (protected)
  └── endSpan(span, metadata?): void     (protected)
```

`PipelineContext` is injected once by the Orchestrator and flows through the entire DAG:
```typescript
interface PipelineContext {
  eventBus: IEventBus;
  tracer: ITracer;
  traceId: string;
}
```

**Every component is a PipelineStep**:

| Component | TInput | TOutput |
|-----------|--------|---------|
| SignalAdapter | `RawSignal` | `Signal` |
| TaskFactory | `Signal` | `Task` |
| Prioritizer | `Task[]` | `Task[]` |
| ComplexityEstimator | `Task` | `ComplexityScore` |
| TaskDecomposer | `Task` | `SubTask[]` |
| ModelSelector | `SubTask` | `ModelChoice` |
| Dispatcher | `SubTask[]` | `TaskResult[]` |
| Agent | `SubTask` | `TaskResult` |
| Aggregator | `TaskResult[]` | `FinalResult` |
| Responder | `FinalResult` | `DeliveryReceipt` |
| Orchestrator | `Task` | `FinalResult` |

### 6. `Agent` (`agent.ts`)

**Purpose**: A PipelineStep that owns an LLMCaller. The base for all concrete agents.

```
Agent extends PipelineStep<SubTask, TaskResult> implements IAgent
  ├── manifest: AgentManifest              (abstract — declares capabilities, limits)
  ├── llmCaller: ILLMCaller                (abstract — the LLM provider to use)
  ├── execute(subTask): TaskResult         (full lifecycle with retry/fallback)
  ├── buildPrompt(subTask): string         (abstract — agent-specific prompt)
  ├── buildSystemPrompt(subTask): string   (abstract — agent-specific system prompt)
  ├── parseOutput(raw, subTask): unknown   (abstract — agent-specific output parsing)
  └── calculateCost(usage, model): number  (default: uses model.estimatedCost)
```

**Execute lifecycle**:
1. Guard: if no `assignedModel`, return failure immediately
2. Start trace span
3. `attempt(currentModel)`:
   a. Build prompt + system prompt
   b. Call LLM
   c. Parse output
   d. On success: emit `subtask:completed`, return `TaskResult`
   e. On failure: increment retries, emit `subtask:failed`
   f. If retries ≤ maxRetries AND fallback exists: emit `model:fallback`, recurse with fallback model
   g. If exhausted: return failure `TaskResult`
4. End trace span with metadata

**AgentManifest** (what each agent declares):
```typescript
interface AgentManifest {
  id: string;                          // unique identifier
  tags: CapabilityTag[];               // e.g. ["search", "codebase", "read-only"]
  complexityRange: [number, number];   // e.g. [1, 4] — this agent handles simple tasks
  tokenProfile: TokenProfile;          // { min, max, typical }
  preferredModels: string[];           // e.g. ["claude-haiku", "gemini-flash"]
  timeoutMs: number;
  maxRetries: number;
}
```

---

### Concrete Implementations

### 7. `BudgetTracker` (`budget-tracker.ts`)

**Purpose**: Per-provider token and cost ledger. Both a subscriber (listens to `token:consumed` events) and an emitter (fires `budget:threshold` and `budget:exhausted`).

```
BudgetTracker extends Configurable<BudgetConfig> implements IBudgetTracker
  ├── initialize(providers: string[]): void   (seeds all providers from config)
  ├── getState(provider): BudgetState         (returns snapshot copy)
  ├── getAllStates(): BudgetState[]           (all provider snapshots)
  ├── canAfford(provider, tokens, cost): bool (used by ModelSelector)
  ├── recordUsage(provider, usage, cost): void (updates ledger, emits events)
  ├── reset(provider): void                   (resets consumed to 0)
  └── destroy(): void                         (unsubscribes from eventBus)
```

**Internal config** (`BudgetConfig`):
```typescript
{
  defaultCap: number;       // hard limit per provider
  softCapRatio: number;     // e.g. 0.8 → warn at 80% consumption
}
```

**Event flow**:
- Subscribes to `token:consumed` on initialization
- `recordUsage()` emits `token:consumed` with remaining balance
- When remaining ≤ softCap: emits `budget:threshold`
- When remaining ≤ 0: emits `budget:exhausted`
- `onTokenConsumed()` is the event handler — validates payload then delegates to `recordUsage()`

**Design note**: The BudgetTracker subscribes to its own events. When `recordUsage()` emits `token:consumed`, the handler `onTokenConsumed` would re-enter. This is intentional for external consumers to also trigger budget updates, but the internal `recordUsage()` call already updates state before emitting, so re-entry is idempotent.

### 8. `AgentRegistry` (`agent-registry.ts`)

**Purpose**: Service registry for agents. Stores manifests, provides lookup by tags and complexity range.

```
AgentRegistry implements IAgentRegistry
  ├── register(manifest): void       (stores manifest, emits agent:registered)
  ├── unregister(agentId): void      (removes manifest, emits agent:unregistered)
  ├── get(agentId): AgentManifest?   (direct lookup)
  ├── findByTags(tags[]): AgentManifest[]  (AND match — all tags must be present)
  ├── findByComplexity(score): AgentManifest[]  (score within [min, max] range)
  └── getAll(): AgentManifest[]      (all registered manifests)
```

**Lookup semantics**:
- `findByTags` uses AND logic: an agent must have **all** requested tags to match
- `findByComplexity` uses range check: `score >= min && score <= max`
- The Dispatcher uses both: first filters by tags, then prefers agents whose complexity range matches, falls back to any tag-matching agent

### 9. `Dispatcher` (`dispatcher.ts`)

**Purpose**: DAG-aware parallel executor. Fans out SubTasks to agents, respecting dependency order and concurrency limits.

```
Dispatcher extends PipelineStep<SubTask[], TaskResult[]> implements IDispatcher
  ├── execute(subTasks[]): TaskResult[]  (main dispatch loop)
  ├── findAgent(subTask): IAgent?        (matches by tags + complexity)
  └── noAgentResult(subTask): TaskResult (failure result when no agent found)
```

**Execution algorithm**:
1. Maintain three sets: `results` (completed), `inFlight` (running), `completed` (done IDs)
2. `getReady()`: filter sub-tasks where all `dependencies[]` are in `completed` and not already running
3. Main loop:
   a. Compute available slots = `maxConcurrency - inFlight.size`
   b. Launch up to `slots` ready sub-tasks
   c. `await Promise.race(inFlight.values())` — wait for any one to finish
   d. On completion: remove from `inFlight`, add to `completed`, store result
4. Deadlock detection: if no ready tasks and nothing in flight, mark remaining as failed (cycle or missing dependency)
5. Return results in original sub-task order

**Agent matching** (`findAgent`):
1. Query registry by `subTask.capabilityTags` (AND match)
2. Filter candidates by complexity range match
3. Try complexity-matched agents first, then fall back to any tag-matched agent
4. Look up the agent instance from the `agents` Map

### 10. `Orchestrator` (`orchestrator.ts`)

**Purpose**: The main pipeline. Composes all orchestration steps and executes the full flow from Task to FinalResult.

```
Orchestrator extends PipelineStep<Task, FinalResult> implements IOrchestrator
  ├── execute(task): FinalResult              (the full pipeline)
  ├── estimateComplexity(task): ComplexityScore  (delegates to estimator)
  ├── decomposeIfNeeded(task, score): SubTask[]  (threshold check + decompose)
  ├── assignModels(subTasks): SubTask[]        (model selection per sub-task)
  ├── dispatch(subTasks): TaskResult[]         (delegates to dispatcher)
  └── aggregate(task, results): FinalResult    (delegates to aggregator)
```

**Constructor dependencies**:
```typescript
{
  estimator: IComplexityEstimator;
  decomposer: ITaskDecomposer;
  modelSelector: IModelSelector;
  dispatcher: IDispatcher;
  aggregator: IAggregator;
  budgetTracker: IBudgetTracker;
  eventBus: IEventBus;
  tracer: ITracer;
  decompositionThreshold: number;
}
```

**Execute flow**:
1. Start a new trace for this task
2. Emit `task:created`
3. Start `orchestrate` span
4. **Estimate complexity** → calls `estimator.execute(task)`, records span
5. **Decompose if needed**:
   - If score ≤ threshold: wraps task in a single direct `SubTask` (no decomposition)
   - If score > threshold: calls `decomposer.decompose(task, score)`, emits `task:decomposed`
6. **Assign models** → for each SubTask, calls `modelSelector.select(st, budget)`, emits `model:selected`, sets `assignedModel` on SubTask
7. **Dispatch** → calls `dispatcher.execute(subTasks)`, records span
8. **Aggregate** → calls `aggregator.aggregate(task, results)`, records span
9. Emit `task:completed` with totals
10. End trace
11. On any error: emit `task:failed`, return failure `FinalResult`, end trace

**Direct execution path** (low complexity): When score ≤ threshold, the Orchestrator creates a single SubTask wrapping the original task. This means the Decomposer is never called, and the task goes straight to model selection → dispatch → aggregation. This is the fast path for simple tasks.

---

## Microservices Equivalents

The AI Factory maps directly to microservices patterns:

| Microservices Pattern | AI Factory Equivalent | Implementation |
|----------------------|----------------------|----------------|
| **Service Registry** | Agent Registry (`IAgentRegistry`) | Agents register manifests with tags, complexity range, preferred models |
| **API Gateway** | Orchestrator + Dispatcher | Single entrypoint, routes to agents, handles auth/rate-limit |
| **Message Broker** | EventBus | Async events: token consumed, task done, budget hit |
| **Circuit Breaker** | Agent retry + model fallback | Agent fails → retry with cheaper model or different provider |
| **Load Balancer** | Model Selector | Distributes work across providers based on cost, capacity, latency |
| **Health Check** | Agent readiness probe | Is agent loaded? Is its preferred model available? |
| **Distributed Tracing** | Tracer (TaskTrace + TraceSpan) | Track decomposition → dispatch → aggregate, with token costs per span |
| **Service Mesh** | PipelineContext injection | Sidecar-like concerns: logging, metrics, auth, retries — injected into every PipelineStep |
| **Saga Pattern** | SubTask DAG with rollback | If sub-task B fails and A already succeeded, compensate or retry |
| **Bulkhead** | Per-provider budget cap | One provider exhausted → isolate, don't cascade |
| **Backpressure** | Concurrency limiter in Dispatcher | Too many sub-tasks → throttle, queue, or degrade |

---

## All Data Types

### Channel & Provider Enums

| Type | Values |
|------|--------|
| `Channel` | `"email"` \| `"slack"` \| `"webhook"` \| `"cron"` \| `"filesystem"` \| `"api"` |
| `Provider` | `"openai"` \| `"anthropic"` \| `"google"` \| `"mistral"` \| `"groq"` \| `"deepseek"` \| `"ollama"` \| `"omlx"` |
| `Priority` | `"critical"` \| `"high"` \| `"normal"` \| `"batch"` |
| `CapabilityTag` | `string` (freeform, e.g. `"search"`, `"codebase"`, `"read-only"`) |

### Signal Layer

| Type | Purpose | Key Fields |
|------|---------|------------|
| `RawSignal` | Raw external event from a sensor | `channel`, `payload` (unknown), `receivedAt`, `metadata?` |
| `Signal` | Normalized, channel-independent message | `channel`, `content` (string), `receivedAt`, `metadata` |

### Task Layer

| Type | Purpose | Key Fields |
|------|---------|------------|
| `TaskOrigin` | Provenance — where the task came from and how to reply | `channel`, `replyTo`, `messageId`, `rawPayload` |
| `Task` | The unit of work | `id`, `description`, `context`, `origin`, `priority`, `createdAt`, `constraints?` |
| `TaskConstraints` | Optional limits on execution | `maxBudget?`, `deadline?`, `requiredCapabilities?`, `preferredProviders?` |

### Complexity & Decomposition

| Type | Purpose | Key Fields |
|------|---------|------------|
| `ComplexityScore` | How hard is this task? | `score` (1–10), `confidence` (0–1), `reasoning`, `estimatedTokens` |
| `TokenEstimate` | Predicted token usage range | `min`, `max`, `expected` |
| `SubTask` | A decomposed unit of work | extends Task fields + `parentTaskId`, `dependencies[]`, `capabilityTags[]`, `assignedModel?` |

### Model Selection

| Type | Purpose | Key Fields |
|------|---------|------------|
| `ModelInfo` | Static model catalog entry | `provider`, `modelId`, `maxTokens`, `costPer1kInput`, `costPer1kOutput`, `capabilities` |
| `DiscoveredModel` | Live-discovered model from a provider API | `provider`, `modelId`, `ownedBy` |
| `ModelChoice` | Selected model for a SubTask | `provider`, `modelId`, `estimatedTokens`, `estimatedCost`, `fallback?` |

### Execution Results

| Type | Purpose | Key Fields |
|------|---------|------------|
| `TaskResult` | One agent's output | `subTaskId`, `output`, `success`, `error?`, `actualTokens`, `actualCost`, `modelUsed`, `latencyMs`, `retries` |
| `TokenUsage` | Actual token consumption | `input`, `output`, `total` |
| `FinalResult` | Aggregated output for the whole task | `taskId`, `output`, `success`, `subResults[]`, `totalTokens`, `totalCost`, `totalLatencyMs`, `modelBreakdown` |

### Budget

| Type | Purpose | Key Fields |
|------|---------|------------|
| `BudgetState` | Per-provider budget ledger | `provider`, `allocated`, `consumed`, `remaining`, `cap` (hard), `softCap` (warning threshold) |

### Agent Manifest

| Type | Purpose | Key Fields |
|------|---------|------------|
| `AgentManifest` | What an agent declares about itself | `id`, `tags[]`, `complexityRange`, `tokenProfile`, `preferredModels[]`, `timeoutMs`, `maxRetries` |
| `TokenProfile` | Agent's typical token usage | `min`, `max`, `typical` |

### Events & Tracing

| Type | Purpose | Key Fields |
|------|---------|------------|
| `EventType` | 14 union string literals | `task:created`, `task:decomposed`, `task:completed`, `task:failed`, `subtask:started`, `subtask:completed`, `subtask:failed`, `model:selected`, `model:fallback`, `token:consumed`, `budget:threshold`, `budget:exhausted`, `agent:registered`, `agent:unregistered` |
| `FactoryEvent` | An emitted event | `type`, `timestamp`, `payload` (Record), `traceId` |
| `TaskTrace` | Full trace for one task | `traceId`, `taskId`, `spans[]`, `startedAt`, `completedAt?` |
| `TraceSpan` | One operation within a trace | `spanId`, `parentSpanId?`, `component`, `action`, `startedAt`, `completedAt?`, `metadata` |

### Config

| Type | Purpose | Key Fields |
|------|---------|------------|
| `FactoryConfig` | Root configuration | `complexity` (threshold + estimator model), `budget` (caps + ratios), `dispatch` (concurrency + timeout), `models[]`, `agents[]` |

### Delivery

| Type | Purpose | Key Fields |
|------|---------|------------|
| `DeliveryReceipt` | Confirmation of outbound delivery | `taskId`, `channel`, `deliveredAt`, `success`, `error?` |

---

## All Interfaces

### Inbound (Sensor → Task)

| Interface | Signature | Role |
|-----------|-----------|------|
| `IObservable<T>` | `subscribe(handler) → Subscription` | Observable pattern for sensor streams |
| `ISensor` | `channel`, `start()`, `stop()`, `signals: IObservable<RawSignal>` | Detects external events |
| `ISignalAdapter` | `channel`, `adapt(raw: RawSignal) → Signal` | Normalizes raw signal per channel |
| `ITaskFactory` | `create(signal: Signal) → Task` | Enriches signal into a task |
| `IPrioritizer` | `prioritize(tasks: Task[]) → Task[]` | Orders task queue |

### Core Orchestration

| Interface | Extends | Signature | Role |
|-----------|---------|-----------|------|
| `IOrchestrator` | `IPipelineStep<Task, FinalResult>` | `execute(task) → FinalResult` | The main entrypoint — runs the full pipeline |
| `IComplexityEstimator` | `IPipelineStep<Task, ComplexityScore>` | `execute(task) → ComplexityScore` | Scores task difficulty |
| `ITaskDecomposer` | — | `decompose(task, score) → SubTask[]` | Splits into sub-task DAG |
| `IModelSelector` | — | `select(subTask, budget[]) → ModelChoice` | Picks cheapest capable model |
| `IDispatcher` | `IPipelineStep<SubTask[], TaskResult[]>` | `execute(subTasks[]) → TaskResult[]` | Fans out to agents |
| `IAgent` | `IPipelineStep<SubTask, TaskResult>` | `manifest`, `execute(subTask) → TaskResult` | Executes one sub-task |
| `IAggregator` | — | `aggregate(task, results[]) → FinalResult` | Merges results |

### Outbound

| Interface | Signature | Role |
|-----------|-----------|------|
| `IResponder` | `channel`, `respond(result, task) → DeliveryReceipt` | Delivers result to originating channel |

### Cross-Cutting

| Interface | Signature | Role |
|-----------|-----------|------|
| `IEventBus` | `emit(event)`, `on(type, handler) → Subscription`, `off(type, handler)` | Decoupled pub/sub |
| `ITracer` | `startTrace`, `startSpan`, `endSpan`, `endTrace`, `getTrace` | Distributed tracing |
| `IBudgetTracker` | `getState`, `getAllStates`, `canAfford`, `recordUsage`, `reset` | Per-provider token/cost ledger |
| `IAgentRegistry` | `register`, `unregister`, `get`, `findByTags`, `findByComplexity`, `getAll` | Agent discovery |
| `IRepository<T>` | `get`, `getAll`, `save`, `delete`, `query` | Generic persistence |
| `ILLMCaller` | `call`, `callStructured<T>`, `estimateTokens`, `listModels` | LLM provider abstraction |
| `IConfigurable<TConfig>` | `config`, `loadConfig`, `validateConfig` | Configuration loading/validation |
| `IPipelineStep<TIn, TOut>` | `name`, `execute(input) → TOutput`, `validate?(input)` | The universal building block |

---

## File-by-File Breakdown

### `src/core/types.ts` (239 lines)

All data types. No logic, no imports (except internal references). Organized in sections:
- Channels, Providers, Models, Capabilities, Priority
- Signal Layer (RawSignal, Signal)
- Task Layer (TaskOrigin, Task, TaskConstraints)
- Complexity (ComplexityScore, TokenEstimate)
- Decomposition (SubTask)
- Model Selection (ModelChoice)
- Execution (TaskResult, TokenUsage, FinalResult)
- Budget (BudgetState)
- Agent Manifest (AgentManifest, TokenProfile)
- Delivery (DeliveryReceipt)
- Events (EventType union, FactoryEvent)
- Tracing (TaskTrace, TraceSpan)
- Config (FactoryConfig)

### `src/core/interfaces.ts` (192 lines)

All contracts. Imports types from `types.ts`. Organized in sections matching the workflow:
- Observable pattern (Subscription, IObservable)
- Inbound: ISensor, ISignalAdapter, ITaskFactory, IPrioritizer
- Core: IComplexityEstimator (extends IPipelineStep), ITaskDecomposer, IModelSelector, IDispatcher (extends IPipelineStep), IAgent (extends IPipelineStep), IAggregator
- Outbound: IResponder
- Cross-cutting: IEventBus, ITracer, IBudgetTracker, IAgentRegistry, IRepository, ILLMCaller, IConfigurable, IPipelineStep
- LLM-specific: LLMCallOptions, LLMCallResult

**Interface hierarchy**: `IComplexityEstimator`, `IDispatcher`, `IAgent`, and `IOrchestrator` all extend `IPipelineStep<TInput, TOutput>`. This means they inherit `name`, `execute(input) → output`, and optional `validate(input)`. The universal contract is `execute()` — every processing component uses the same method name.

### `src/core/configurable.ts` (20 lines)

Abstract base class. `loadConfig()` calls `validateConfig()` (abstract) and throws if errors exist. Generic over `TConfig`, defaults to `FactoryConfig`.

### `src/core/event-bus.ts` (40 lines)

Concrete implementation. `Map<eventType, Set<handler>>`. `emit()` is fire-and-forget with per-handler error isolation (`.catch()`). `on()` returns a `Subscription` with `unsubscribe()`. Extra `listenerCount()` for debugging.

### `src/core/repository.ts` (29 lines)

`InMemoryRepository<T extends { id: string }>`. Uses `Map<string, T>`. `save()` does `structuredClone` for immutability. `query()` does in-memory filter. Async API for future DB swap.

### `src/core/llm-caller.ts` (28 lines)

Abstract base. `call()` is abstract — provider-specific implementations (OpenAI, Anthropic, etc.) extend this. `callStructured<T>()` wraps `call()` with JSON response format and parses. `estimateTokens()` is abstract. `listModels()` is abstract. `buildUsage()` is a protected helper.

### `src/core/pipeline-step.ts` (44 lines)

The backbone. Abstract `name` and `execute()`. Optional `validate()`. `PipelineContext` (eventBus + tracer + traceId) is injected via `setContext()`. Protected helpers `emit()` and `startSpan()`/`endSpan()` automatically attach the traceId. If context is not set, these are no-ops — safe to use without the full framework.

### `src/core/agent.ts` (109 lines)

Extends `PipelineStep<SubTask, TaskResult>`. Requires `manifest` and `llmCaller` (both abstract). `execute()`:
1. Guards against missing `assignedModel`
2. Starts trace span
3. Inner `attempt()` function with retry loop:
   - Builds prompt + system prompt (abstract methods)
   - Calls LLM
   - Parses output (abstract method)
   - On failure: retries with fallback model if available
4. Ends trace span with success/retry metadata

Three abstract methods subclasses must implement: `buildPrompt()`, `buildSystemPrompt()`, `parseOutput()`.

### `src/core/tracer.ts` (52 lines)

Concrete implementation. `Map<traceId, TaskTrace>`. `startTrace()` generates UUID via `crypto.randomUUID()`. `startSpan()` uses an incrementing counter for span IDs. `endSpan()` sets `completedAt` and merges metadata. `endTrace()` sets trace `completedAt`.

### `src/core/budget-tracker.ts` (116 lines)

Concrete implementation. Extends `Configurable<BudgetConfig>`. Maintains a `Map<provider, BudgetState>`. `initialize()` seeds all providers from config and subscribes to `token:consumed` events. `recordUsage()` updates the ledger and emits `token:consumed`, `budget:threshold`, and `budget:exhausted` events. `canAfford()` is the gate used by ModelSelector. `getState()` and `getAllStates()` return snapshot copies to prevent external mutation. `destroy()` unsubscribes from the event bus.

### `src/core/agent-registry.ts` (60 lines)

Concrete implementation. `Map<agentId, AgentManifest>`. `register()` and `unregister()` emit `agent:registered` / `agent:unregistered` events. `findByTags()` uses AND logic — all requested tags must be present. `findByComplexity()` checks score against `[min, max]` range. Used by the Dispatcher to match SubTasks to agents.

### `src/core/dispatcher.ts` (144 lines)

Concrete implementation. Extends `PipelineStep<SubTask[], TaskResult[]>`. DAG-aware parallel executor. Uses a `while` loop with `Promise.race` — launches up to `maxConcurrency` ready sub-tasks, waits for any to finish, then launches more. Detects deadlocked cycles (no ready tasks + nothing in flight → mark remaining as failed). `findAgent()` matches by tags first, then prefers complexity range match, falls back to any tag match. Returns results in original sub-task order.

### `src/core/orchestrator.ts` (183 lines)

Concrete implementation. Extends `PipelineStep<Task, FinalResult>`. The main pipeline composer. Constructor takes all dependencies via a single `deps` object. `execute()` runs the full flow: estimate → decompose (or skip if below threshold) → assign models → dispatch → aggregate. Each phase creates its own trace span. On error, returns a failure `FinalResult` with empty sub-results. The `decomposeIfNeeded()` method implements the fast path: if complexity ≤ threshold, wraps the task in a single direct SubTask without calling the decomposer.

### `src/core/complexity-estimator.ts`

Concrete implementation. Extends `PipelineStep<Task, ComplexityScore>`. Uses an LLM (configurable model) to score task complexity on a 1–10 scale, with confidence (0–1) and token estimates. Output is JSON-enforced via `llmCaller.callStructured<T>()`. Emits trace spans with score/confidence metadata.

### `src/core/task-decomposer.ts`

Concrete implementation. Implements `ITaskDecomposer`. Uses an LLM to break a complex task into a DAG of `SubTask[]`. Each sub-task gets: description, capability tags, dependency indices, and its own complexity score. The dependency indices are mapped to `${taskId}-sub-${index}` IDs. Output is JSON-enforced via `llmCaller.callStructured<T>()`.

### `src/core/model-catalog.ts`

Concrete implementation. `ModelCatalog` aggregates live-discovered models across all configured LLM callers. It takes an array of `ILLMCaller` instances plus a static `ModelInfo[]` catalog, then exposes:
- `discoverAll(): Promise<CatalogEntry[]>` — queries every caller's `listModels()` method in parallel, deduplicates by `provider:modelId`, and cross-references with the static catalog to attach cost and capability metadata.
- `getStaticModels(): ModelInfo[]` — returns the original config catalog.
- `findByProvider(provider): CatalogEntry[]` — static models for a provider.

This is how the system supports **both local and cloud model discovery**: local servers like Ollama (`/v1/models`) and oMLX (`/v1/models`) expose the same endpoint as cloud providers, so one generic query pattern works everywhere.

### `src/core/secrets.ts`

Simple secrets abstraction. `SecretsProvider` interface with a single `get(key)` method. `EnvSecretsProvider` reads from `process.env`. Used by `AIFactory` to load API keys for cloud providers.

### `src/agents/search-agent.ts`

Concrete agent. Capabilities: `search`, `codebase`, `read-only`. Handles simple lookup and codebase search tasks. Extends `Agent` and implements `buildPrompt()`, `buildSystemPrompt()`, `parseOutput()`.

### `src/agents/analysis-agent.ts`

Concrete agent. Capabilities: `analysis`, `reasoning`. Handles moderate-to-complex reasoning, pattern detection, and risk assessment.

### `src/agents/summarizer-agent.ts`

Concrete agent. Capabilities: `summarization`, `synthesis`. Condenses inputs into concise outputs.

### `src/agents/executor-agent.ts`

Concrete agent. Capabilities: `execution`, `code-generation`, `write`. Generates and executes code/commands.

### `src/agents/file-io-agent.ts`

Concrete agent. Capabilities: `file-io`, `read-only`, `write`. Reads, writes, and lists files.

### `src/factory.ts`

Main wiring class. `AIFactory` takes `FactoryConfig` + `SecretsProvider` and constructs the entire system:
- Creates `EventBus`, `Tracer`
- Configures `BudgetTracker` and initializes per-provider budgets
- Registers all agent manifests in `AgentRegistry`
- Builds LLM callers from configured providers + env keys
- Instantiates all 5 concrete agents
- Builds `Dispatcher`, `ComplexityEstimator`, `TaskDecomposer`, `ModelSelector`, `Aggregator`
- Constructs `Orchestrator`
- Creates `TaskFactory`, `Prioritizer`, `InMemoryTaskQueue`
- Exposes `registerSensor()`, `registerAdapter()`, `registerResponder()`, `start()`, `stop()`

### `src/main.ts`

Runtime entrypoint. Loads `factory.config.json`, creates `EnvSecretsProvider`, instantiates `AIFactory`, registers all adapters/responders/sensors, and starts the main loop.

### `src/sensors/cron-sensor.ts`

Concrete sensor. Emits `RawSignal` on a timer via the `Subject<T>` observable. Fully functional.

### `src/sensors/webhook-sensor.ts`

Sensor stub. Has a placeholder `start()`/`stop()` and an `inject()` helper for manual signal injection. A real HTTP server integration (express/fastify) is a future enhancement.

### `src/core/index.ts`, `src/agents/index.ts`, `src/adapters/index.ts`, `src/responders/index.ts`, `src/sensors/index.ts`, `src/llm/index.ts`

Barrel exports for each module layer. Re-export all public types and classes from the directory.

---

## Key Design Decisions

### 1. `PipelineStep<TInput, TOutput>` is the universal abstraction

Every component that processes data is a PipelineStep. This gives us:
- Uniform interface (`execute(input) → output`)
- Uniform cross-cutting concerns (tracing, events) via `PipelineContext`
- Composability — the Orchestrator is just a PipelineStep that composes others
- Testability — each step can be tested in isolation with a mock context

### 2. Model choice is embedded in `SubTask`, not passed separately

`SubTask.assignedModel` is set by the ModelSelector before dispatch. This keeps the `PipelineStep.execute()` contract single-argument (`input → output`). The Agent reads `subTask.assignedModel` internally. The Dispatcher no longer needs a separate `Map<SubTask, ModelChoice>`.

### 3. `Task.origin` flows untouched through the pipeline

The Orchestrator and Agents never inspect `origin`. Only the Responder consumes it. This is the equivalent of a correlation ID in microservices — it travels with the request but is opaque to business logic.

### 4. EventBus is fire-and-forget with error isolation

Handlers can be async. If one handler throws, it doesn't affect others or the emitter. This prevents cascading failures from monitoring/logging code.

### 5. Agent is a PipelineStep that owns an LLMCaller

Not a separate hierarchy. The only difference between an Agent and any other PipelineStep is that it calls an LLM. This means non-LLM steps (Prioritizer, Aggregator) share the same base class.

### 6. Repository is async by contract, in-memory by default

The `IRepository` interface is async, allowing future swap to PostgreSQL, SQLite, or file-based storage without changing consumers. The `InMemoryRepository` satisfies the contract for development and testing.

### 7. `LLMCaller` is abstract — one concrete class per provider

OpenAI, Anthropic, Google, Mistral, Groq, Deepseek each get their own `LLMCaller` subclass implementing `call()` and `estimateTokens()`. The `callStructured<T>()` method is shared via the base class.

### 8. Everything is typed with strict TypeScript

`strict: true`, `noUncheckedIndexedAccess: true`. No `any` types. `unknown` for raw payloads that need validation before use. Discriminated unions for events.

### 9. Interfaces that are PipelineSteps extend `IPipelineStep`

`IComplexityEstimator`, `IDispatcher`, `IAgent`, and `IOrchestrator` all extend `IPipelineStep<TInput, TOutput>`. This means they inherit `name`, `execute(input) → output`, and optional `validate(input)`. The universal contract is `execute()` — every processing component uses the same method name. Components with multi-argument signatures (`ITaskDecomposer.decompose(task, score)`, `IModelSelector.select(subTask, budget)`, `IAggregator.aggregate(task, results)`) do not extend `IPipelineStep` because their signatures don't match the single-input contract.

### 10. Development Workflow

The project uses three verification gates:

- `npm run typecheck` — `tsc --noEmit` with `strict: true`
- `npm test` — `vitest run` for the full unit-test suite
- `npm run lint` — `eslint src/` using `typescript-eslint`

All three must pass before a change is considered complete.

### 11. Orchestrator has a fast path for simple tasks

When complexity score ≤ `decompositionThreshold`, the Orchestrator skips the Decomposer entirely. It wraps the task in a single direct `SubTask` and proceeds straight to model selection → dispatch → aggregation. This avoids unnecessary LLM calls for tasks that don't need decomposition.

### 12. Dispatcher uses Promise.race for DAG execution

Instead of topological sort + sequential execution, the Dispatcher uses a dynamic `while` loop: compute ready tasks (all dependencies satisfied), launch up to `maxConcurrency`, `await Promise.race()` on in-flight tasks, repeat. This maximizes parallelism while respecting the DAG. Deadlock detection: if no tasks are ready and nothing is in flight, remaining tasks are marked as failed (cycle or missing dependency).

### 13. BudgetTracker is both subscriber and emitter

It subscribes to `token:consumed` events (so external systems can trigger budget updates) and emits `budget:threshold` and `budget:exhausted` events (so monitoring systems can react). The `recordUsage()` method updates state directly; `token:consumed` events from external sources are handled by the same internal update path, but `recordUsage()` does not re-emit `token:consumed` to avoid recursive loops.
