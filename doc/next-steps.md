# AI Factory — Next Steps: Implementation Roadmap

## Table of Contents

1. [Current State Summary](#current-state-summary)
2. [Build Order & Dependency Graph](#build-order--dependency-graph)
3. [Phase 1: What Can Be Built Right Now](#phase-1-what-can-be-built-right-now)
4. [Phase 2: LLM Providers](#phase-2-llm-providers)
5. [Phase 3: Orchestrator Dependencies](#phase-3-orchestrator-dependencies)
6. [Phase 4: Concrete Agents](#phase-4-concrete-agents)
7. [Phase 5: Inbound Layer](#phase-5-inbound-layer)
8. [Phase 6: Outbound Layer](#phase-6-outbound-layer)
9. [Phase 7: Wiring & Entrypoint](#phase-7-wiring--entrypoint)
10. [Phase 8: Supporting Infrastructure](#phase-8-supporting-infrastructure)
11. [Phase 9: Real-World Integrations](#phase-9-real-world-integrations)
12. [External Dependencies (npm packages)](#external-dependencies-npm-packages)
13. [Master Checklist](#master-checklist)

---

## Current State Summary

| Layer | Total Needed | Concrete Exist | Abstract Exist | Interface Only | Completely Missing |
|---|---|---|---|---|---|
| **Types** | 26 interfaces/types | 26 (all pure types) | 0 | 0 | 0 |
| **Interfaces** | 18 contracts | 0 | 0 | 18 | 0 |
| **LLM Providers** | 1 abstract + 6 concrete + 2 local | 4 (`OpenAICaller`, `AnthropicCaller`, `GoogleCaller`, `OpenAICompatibleCaller`) | 1 (`LLMCaller`) | 0 | 3 (Mistral/Groq/Deepseek available via factory only) |
| **Orchestrator Core** | 1 orch + 5 deps | 5 (`Orchestrator`, `Dispatcher`, `ComplexityEstimator`, `TaskDecomposer`, plus `Aggregator` and `ModelSelector` from Phase 1) | 0 | 0 | 0 |
| **Agents** | 1 abstract + 5 concrete | 5 (`SearchAgent`, `AnalysisAgent`, `SummarizerAgent`, `ExecutorAgent`, `FileIOAgent`) | 1 (`Agent`) | 0 | 0 |
| **Inbound** | 1 Observable + 5 Sensors + 5 Adapters + 1 Factory + 1 Prioritizer + 1 Queue | 9 (`Subject`, `CronSensor`, `WebhookSensor` stub, 5 Adapters, `TaskFactory`, `Prioritizer`, `InMemoryTaskQueue`) | 0 | 6 interfaces | 3+ (`EmailSensor`, `SlackSensor`, real `WebhookSensor` HTTP server) |
| **Outbound** | 5 Responders | 5 (stubs) | 0 | 1 interface | 0 (real transport still missing for email/Slack/webhook) |
| **Cross-cutting** | 7 | 6 (`EventBus`, `Tracer`, `BudgetTracker`, `AgentRegistry`, `InMemoryRepository`, `SecretsProvider`) | 2 (`Configurable`, `PipelineStep`) | 0 | 0 |
| **Wiring/Entrypoint** | 3+ | 3 (`AIFactory`, `src/index.ts` barrel, `src/main.ts`) | 0 | 0 | 0 |
| **Tests** | N | 155 (all components + integration + Phase 8 logger/rate-limiter/circuit-breaker) | 0 | 0 | 0 |
| **Infrastructure** | ~8 concerns | 0 | 0 | 0 | Logging, metrics, rate limiting, health checks, DB persistence, full circuit breaker, input validation |

**What compiles:** All source files pass `tsc --noEmit` with zero errors.

**What lints clean:** `npm run lint` passes with `typescript-eslint` and zero errors.

**What tests pass:** `npm test` runs 155 tests across Phase 1–7 core components, adapters, LLM callers, agents, responders, orchestrator dependencies, the end-to-end `AIFactory` integration, `Logger`, `RateLimiter`, and `CircuitBreaker`.

**What can actually run:** `src/main.ts` can start the full system end-to-end. It loads `factory.config.json`, constructs the `AIFactory`, registers adapters/responders/sensors, and runs the main loop. Real LLM calls require API keys in environment variables. Cron sensor is fully functional; webhook sensor is a stub; email/Slack/webhook responders are stubs. Integration tests in `src/__tests__/factory.test.ts` exercise the cron and webhook paths with a fake LLM caller.

---

## Build Order & Dependency Graph

The critical path to a working system, in dependency order:

```
1. Concrete Observable class              ← no dependencies
2. Concrete LLMCaller subclasses           ← depends on: LLMCaller (exists), HTTP/SDK (missing from package.json)
3. Concrete Agent subclasses               ← depends on: Agent (exists), LLMCaller (step 2)
4. Concrete ComplexityEstimator            ← depends on: PipelineStep (exists), LLMCaller (step 2)
5. Concrete TaskDecomposer                 ← depends on: LLMCaller (step 2)
6. Concrete ModelSelector                  ← depends on: BudgetTracker (exists), ModelInfo catalog
7. Concrete Aggregator                     ← depends on: types only (all exist)
8. Concrete Sensors (5)                   ← depends on: Observable (step 1)
9. Concrete SignalAdapters (5)            ← depends on: types only (all exist)
10. Concrete TaskFactory                   ← depends on: IRepository (exists), types (exist)
11. Concrete Prioritizer                   ← depends on: types only (all exist)
12. Concrete TaskQueue                     ← depends on: IRepository (exists)
13. Concrete Responders (5)                ← depends on: types only (all exist)
14. Config loading mechanism               ← depends on: FactoryConfig type (exists)
15. Factory / entrypoint class             ← depends on: ALL of the above
16. Tests                                  ← depends on: test framework (missing from package.json)
```

---

## Phase 1: What Can Be Built Right Now

These components have **zero external dependencies** and can be implemented immediately with only the existing codebase.

### 1.1 — `Observable` / `Subject` class

**Status:** `IObservable<T>` interface exists. No implementation.

**What to build:** A concrete `Subject<T>` class implementing `IObservable<T>`.

```typescript
// src/core/observable.ts
export class Subject<T> implements IObservable<T> {
  private handlers = new Set<(value: T) => void | Promise<void>>();

  subscribe(handler: (value: T) => void | Promise<void>): Subscription {
    this.handlers.add(handler);
    return { unsubscribe: () => this.handlers.delete(handler) };
  }

  next(value: T): void {
    for (const handler of this.handlers) {
      void Promise.resolve(handler(value)).catch((err) => {
        console.error("[Subject] handler error:", err);
      });
    }
  }

  get subscriberCount(): number {
    return this.handlers.size;
  }
}
```

**Dependencies:** `IObservable<T>`, `Subscription` — both exist in `interfaces.ts`.

**File:** `src/core/observable.ts`

---

### 1.2 — `Aggregator` concrete class

**Status:** `IAggregator` interface exists. No implementation.

**What to build:** A concrete `Aggregator` that merges `TaskResult[]` into `FinalResult`. Two strategies:

**Strategy A — Rule-based (no LLM):** Simple merging. Concatenate outputs, sum tokens/costs, compute max latency. Suitable for structured outputs.

**Strategy B — LLM-based:** Call an LLM to synthesize sub-results into a coherent final output. Requires an `ILLMCaller`.

**Recommendation:** Build Strategy A first (zero dependencies). Add Strategy B later when LLMCallers exist.

```typescript
// src/core/aggregator.ts
export class Aggregator implements IAggregator {
  aggregate(task: Task, results: TaskResult[]): FinalResult {
    const allSucceeded = results.every((r) => r.success);
    const totalTokens: TokenUsage = results.reduce(
      (acc, r) => ({
        input: acc.input + r.actualTokens.input,
        output: acc.output + r.actualTokens.output,
        total: acc.total + r.actualTokens.total,
      }),
      { input: 0, output: 0, total: 0 },
    );
    const totalCost = results.reduce((acc, r) => acc + r.actualCost, 0);
    const totalLatencyMs = results.reduce((acc, r) => acc + r.latencyMs, 0);
    const modelBreakdown: Record<string, TokenUsage> = {};
    for (const r of results) {
      const key = `${r.modelUsed.provider}:${r.modelUsed.modelId}`;
      if (!modelBreakdown[key]) {
        modelBreakdown[key] = { input: 0, output: 0, total: 0 };
      }
      modelBreakdown[key]!.input += r.actualTokens.input;
      modelBreakdown[key]!.output += r.actualTokens.output;
      modelBreakdown[key]!.total += r.actualTokens.total;
    }

    return {
      taskId: task.id,
      output: allSucceeded
        ? results.map((r) => r.output)
        : { error: "Some sub-tasks failed", subResults: results },
      success: allSucceeded,
      subResults: results,
      totalTokens,
      totalCost,
      totalLatencyMs,
      modelBreakdown,
    };
  }
}
```

**Dependencies:** `Task`, `TaskResult`, `FinalResult`, `TokenUsage` — all exist in `types.ts`. `IAggregator` — exists in `interfaces.ts`.

**File:** `src/core/aggregator.ts`

---

### 1.3 — `Prioritizer` concrete class

**Status:** `IPrioritizer` interface exists. No implementation.

**What to build:** Sorts `Task[]` by priority enum, then by creation time (oldest first within same priority).

```typescript
// src/core/prioritizer.ts
const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  batch: 3,
};

export class Prioritizer implements IPrioritizer {
  prioritize(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      return a.createdAt - b.createdAt;
    });
  }
}
```

**Dependencies:** `Task`, `Priority` — exist in `types.ts`. `IPrioritizer` — exists in `interfaces.ts`.

**File:** `src/core/prioritizer.ts`

---

### 1.4 — `TaskFactory` concrete class

**Status:** `ITaskFactory` interface exists. No implementation.

**What to build:** Enriches a `Signal` into a `Task`. Adds UUID, preserves origin, derives priority from metadata.

```typescript
// src/core/task-factory.ts
export class TaskFactory implements ITaskFactory {
  create(signal: Signal): Task {
    return {
      id: crypto.randomUUID(),
      description: signal.content,
      context: signal.metadata,
      origin: {
        channel: signal.channel,
        replyTo: (signal.metadata.replyTo as string) ?? "",
        messageId: (signal.metadata.messageId as string) ?? "",
        rawPayload: signal.metadata.rawPayload,
      },
      priority: this.derivePriority(signal),
      createdAt: Date.now(),
    };
  }

  private derivePriority(signal: Signal): Priority {
    const meta = signal.metadata;
    if (meta.urgent === true || meta.priority === "critical") return "critical";
    if (meta.priority === "high") return "high";
    if (meta.priority === "batch") return "batch";
    return "normal";
  }
}
```

**Dependencies:** `Signal`, `Task`, `TaskOrigin`, `Priority` — exist in `types.ts`. `ITaskFactory` — exists in `interfaces.ts`.

**File:** `src/core/task-factory.ts`

---

### 1.5 — `SignalAdapter` concrete classes (5)

**Status:** `ISignalAdapter` interface exists. No implementations.

**What to build:** One adapter per channel. Each strips channel-specific wrappers and extracts normalized `content` + `metadata`.

```typescript
// src/adapters/email-adapter.ts
export class EmailAdapter implements ISignalAdapter {
  readonly channel = "email";
  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { subject: string; body: string; from: string; messageId: string };
    return {
      channel: "email",
      content: `Subject: ${payload.subject}\n\n${payload.body}`,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: payload.from,
        messageId: payload.messageId,
        subject: payload.subject,
        rawPayload: raw.payload,
      },
    };
  }
}
```

```typescript
// src/adapters/slack-adapter.ts
export class SlackAdapter implements ISignalAdapter {
  readonly channel = "slack";
  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { text: string; channel: string; user: string; ts: string };
    return {
      channel: "slack",
      content: payload.text,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: payload.channel,
        messageId: payload.ts,
        user: payload.user,
        rawPayload: raw.payload,
      },
    };
  }
}
```

```typescript
// src/adapters/webhook-adapter.ts
export class WebhookAdapter implements ISignalAdapter {
  readonly channel = "webhook";
  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { body: unknown; headers: Record<string, string> };
    const content = typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body);
    return {
      channel: "webhook",
      content,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: (raw.metadata?.callbackUrl as string) ?? "",
        messageId: (raw.metadata?.requestId as string) ?? "",
        headers: payload.headers,
        rawPayload: raw.payload,
      },
    };
  }
}
```

```typescript
// src/adapters/cron-adapter.ts
export class CronAdapter implements ISignalAdapter {
  readonly channel = "cron";
  adapt(raw: RawSignal): Signal {
    return {
      channel: "cron",
      content: (raw.payload as { description?: string })?.description ?? "Scheduled task triggered",
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: "",
        messageId: `cron_${raw.receivedAt}`,
        schedule: raw.metadata?.schedule,
        rawPayload: raw.payload,
      },
    };
  }
}
```

```typescript
// src/adapters/filesystem-adapter.ts
export class FileSystemAdapter implements ISignalAdapter {
  readonly channel = "filesystem";
  adapt(raw: RawSignal): Signal {
    const payload = raw.payload as { filePath: string; event: string };
    return {
      channel: "filesystem",
      content: `File event: ${payload.event} on ${payload.filePath}`,
      receivedAt: raw.receivedAt,
      metadata: {
        replyTo: "",
        messageId: `fs_${raw.receivedAt}_${payload.filePath}`,
        filePath: payload.filePath,
        event: payload.event,
        rawPayload: raw.payload,
      },
    };
  }
}
```

**Dependencies:** `RawSignal`, `Signal`, `Channel` — exist in `types.ts`. `ISignalAdapter` — exists in `interfaces.ts`.

**Files:** `src/adapters/email-adapter.ts`, `src/adapters/slack-adapter.ts`, `src/adapters/webhook-adapter.ts`, `src/adapters/cron-adapter.ts`, `src/adapters/filesystem-adapter.ts`

---

### 1.6 — `TaskQueue` (interface + implementation)

**Status:** Mentioned in architecture doc but has **no interface and no implementation** in code.

**What to build:** Define `ITaskQueue` interface, then an `InMemoryTaskQueue` implementation.

```typescript
// src/core/task-queue.ts
export interface ITaskQueue {
  enqueue(task: Task): Promise<void>;
  dequeue(): Promise<Task | undefined>;
  peek(): Promise<Task | undefined>;
  size(): Promise<number>;
  drain(): Promise<Task[]>;
}

export class InMemoryTaskQueue implements ITaskQueue {
  private queue: Task[] = [];

  async enqueue(task: Task): Promise<void> {
    this.queue.push(task);
  }

  async dequeue(): Promise<Task | undefined> {
    return this.queue.shift();
  }

  async peek(): Promise<Task | undefined> {
    return this.queue[0];
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async drain(): Promise<Task[]> {
    const tasks = [...this.queue];
    this.queue = [];
    return tasks;
  }
}
```

**Dependencies:** `Task` — exists in `types.ts`.

**File:** `src/core/task-queue.ts`

---

### 1.7 — `ModelSelector` concrete class

**Status:** `IModelSelector` interface exists. No implementation.

**What to build:** Given a `SubTask` and `BudgetState[]`, picks the cheapest model that can handle the complexity and is within budget. Uses a hardcoded model catalog (can be replaced with config-driven catalog later).

**Selection algorithm:**
1. Filter models by `subTask.capabilityTags` (model must support all required capabilities)
2. Filter models by budget: `budgetTracker.canAfford(provider, estimatedTokens, estimatedCost)`
3. Sort remaining by `estimatedCost` ascending
4. Pick cheapest; if none available, return cheapest over-budget model with a warning
5. Set fallback to the next-cheapest model from a different provider

```typescript
// src/core/model-selector.ts
export class ModelSelector implements IModelSelector {
  private catalog: ModelInfo[];

  constructor(catalog: ModelInfo[]) {
    this.catalog = catalog;
  }

  select(subTask: SubTask, budget: BudgetState[]): ModelChoice {
    const budgetMap = new Map(budget.map((b) => [b.provider, b]));
    const requiredTags = subTask.capabilityTags;

    const candidates = this.catalog
      .filter((m) => requiredTags.every((t) => m.capabilities.includes(t)))
      .map((m) => {
        const estimatedTokens = subTask.complexity.estimatedTokens;
        const estimatedCost =
          (estimatedTokens.expected / 1000) * m.costPer1kInput +
          (estimatedTokens.expected / 1000) * m.costPer1kOutput;
        const state = budgetMap.get(m.provider);
        const affordable = state ? state.remaining >= estimatedCost : false;
        return { model: m, estimatedCost, affordable };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    const affordable = candidates.filter((c) => c.affordable);
    const primary = affordable[0] ?? candidates[0];

    if (!primary) {
      throw new Error(`No model found for capabilities: ${requiredTags.join(", ")}`);
    }

    const fallback = affordable.find(
      (c) => c.model.provider !== primary.model.provider,
    );

    return {
      provider: primary.model.provider,
      modelId: primary.model.modelId,
      estimatedTokens: subTask.complexity.estimatedTokens,
      estimatedCost: primary.estimatedCost,
      fallback: fallback
        ? {
            provider: fallback.model.provider,
            modelId: fallback.model.modelId,
            estimatedTokens: subTask.complexity.estimatedTokens,
            estimatedCost: fallback.estimatedCost,
          }
        : undefined,
    };
  }
}
```

**Dependencies:** `SubTask`, `ModelChoice`, `BudgetState`, `ModelInfo`, `TokenEstimate` — exist in `types.ts`. `IModelSelector` — exists in `interfaces.ts`.

**File:** `src/core/model-selector.ts`

---

### 1.8 — `Responder` concrete classes (5)

**Status:** `IResponder` interface exists. No implementations.

**What to build:** One responder per channel. Each formats the `FinalResult` for the originating channel and delivers it. **Initial versions can stub the actual transport** (log to console instead of sending real email/Slack messages). Real transport is added when external SDKs are integrated.

```typescript
// src/responders/email-responder.ts
export class EmailResponder implements IResponder {
  readonly channel = "email";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const body = this.formatResult(result);
    // TODO: integrate with email sending (SMTP, SendGrid, etc.)
    console.log(`[EmailResponder] Would send to ${task.origin.replyTo}:\n${body}`);

    return {
      taskId: task.id,
      channel: "email",
      deliveredAt: Date.now(),
      success: true,
    };
  }

  private formatResult(result: FinalResult): string {
    if (!result.success) return `Task failed: ${JSON.stringify(result.output)}`;
    return `Result:\n${JSON.stringify(result.output, null, 2)}\n\nTokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)} | Latency: ${result.totalLatencyMs}ms`;
  }
}
```

```typescript
// src/responders/slack-responder.ts
export class SlackResponder implements IResponder {
  readonly channel = "slack";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    const message = this.formatResult(result);
    // TODO: integrate with Slack SDK (chat.postMessage)
    console.log(`[SlackResponder] Would post to ${task.origin.replyTo}, thread: ${task.origin.messageId}:\n${message}`);

    return {
      taskId: task.id,
      channel: "slack",
      deliveredAt: Date.now(),
      success: true,
    };
  }

  private formatResult(result: FinalResult): string {
    if (!result.success) return `❌ Task failed: ${JSON.stringify(result.output)}`;
    return `✅ Completed in ${result.totalLatencyMs}ms | Tokens: ${result.totalTokens.total} | Cost: $${result.totalCost.toFixed(4)}`;
  }
}
```

```typescript
// src/responders/webhook-responder.ts
export class WebhookResponder implements IResponder {
  readonly channel = "webhook";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    // TODO: integrate with HTTP client (fetch/axios) to POST to task.origin.replyTo
    console.log(`[WebhookResponder] Would POST to ${task.origin.replyTo}:`, JSON.stringify(result));

    return {
      taskId: task.id,
      channel: "webhook",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
```

```typescript
// src/responders/cron-responder.ts
export class CronResponder implements IResponder {
  readonly channel = "cron";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    // TODO: write to file, database, or trigger next job
    console.log(`[CronResponder] Cron task ${task.id} completed:`, JSON.stringify(result.output));

    return {
      taskId: task.id,
      channel: "cron",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
```

```typescript
// src/responders/filesystem-responder.ts
export class FileSystemResponder implements IResponder {
  readonly channel = "filesystem";

  async respond(result: FinalResult, task: Task): Promise<DeliveryReceipt> {
    // TODO: write result to file
    console.log(`[FileSystemResponder] File task ${task.id} completed:`, JSON.stringify(result.output));

    return {
      taskId: task.id,
      channel: "filesystem",
      deliveredAt: Date.now(),
      success: true,
    };
  }
}
```

**Dependencies:** `FinalResult`, `Task`, `TaskOrigin`, `DeliveryReceipt`, `Channel` — exist in `types.ts`. `IResponder` — exists in `interfaces.ts`.

**Files:** `src/responders/email-responder.ts`, `src/responders/slack-responder.ts`, `src/responders/webhook-responder.ts`, `src/responders/cron-responder.ts`, `src/responders/filesystem-responder.ts`

---

### 1.9 — Unit tests for existing components

**Status:** Zero tests exist. No test framework configured.

**What to build:** Install vitest, write unit tests for the 5 concrete cross-cutting components that have no external dependencies.

**Test framework setup:**
```bash
npm install -D vitest
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Tests to write:**

| Component | What to test |
|-----------|-------------|
| `EventBus` | emit reaches handler, on returns Subscription, off removes handler, multiple handlers for same event, async handler errors don't crash others, listenerCount accuracy |
| `Tracer` | startTrace creates trace with UUID, startSpan creates span with incrementing ID, endSpan sets completedAt, endTrace sets completedAt, getTrace retrieves, parentSpanId linking |
| `InMemoryRepository` | save then get returns item, getAll returns all, delete removes, query filters correctly, structuredClone prevents mutation of stored item |
| `BudgetTracker` | initialize seeds all providers, recordUsage updates consumed/remaining, canAfford returns correct boolean, emits budget:threshold at softCap, emits budget:exhausted at 0, reset clears consumed, getState returns copy not reference |
| `AgentRegistry` | register stores manifest, unregister removes, get finds by ID, findByTags uses AND logic, findByComplexity uses range check, emits events on register/unregister |
| `Dispatcher` | executes independent sub-tasks in parallel, respects dependencies (sequential), respects maxConcurrency, detects cycles, returns results in original order, handles missing agent gracefully |

**Files:** `src/core/__tests__/event-bus.test.ts`, `src/core/__tests__/tracer.test.ts`, `src/core/__tests__/repository.test.ts`, `src/core/__tests__/budget-tracker.test.ts`, `src/core/__tests__/agent-registry.test.ts`, `src/core/__tests__/dispatcher.test.ts`

---

## Phase 2: LLM Providers

**Status:** Complete for all configured providers. OpenAI and Anthropic SDKs are installed and concrete callers are implemented. `GoogleCaller` is implemented on top of the Gemini OpenAI-compatible endpoint, so it reuses the existing `openai` package and does not require a separate Google SDK.

Implemented callers:
- `OpenAICaller` — native OpenAI SDK
- `AnthropicCaller` — native Anthropic SDK
- `OpenAICompatibleCaller` — serves any OpenAI-compatible API endpoint, including Ollama (cloud + local), oMLX (local), Mistral, Groq, Deepseek

### 2.1 — Install provider SDKs

```bash
npm install openai @anthropic-ai/sdk
```

Note: `@google/generative-ai` was listed in the original plan but is **not installed yet**.

### 2.2 — API Key Management

Create a secrets/config mechanism. Options:
- Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- A `SecretsProvider` interface with env-var implementation
- Loaded at Factory startup, injected into LLMCallers

```typescript
// src/core/secrets.ts
export interface SecretsProvider {
  get(key: string): string | undefined;
}

export class EnvSecretsProvider implements SecretsProvider {
  get(key: string): string | undefined {
    return process.env[key];
  }
}
```

### 2.3 — Concrete `LLMCaller` subclasses

#### `OpenAICaller`

**File:** `src/llm/openai-caller.ts`

Uses the `openai` SDK. Implements:
- `call()` — `client.chat.completions.create()`
- `estimateTokens()` — heuristic: `prompt.length / 4`
- `listModels()` — `client.models.list()` → live OpenAI model list

#### `AnthropicCaller`

**File:** `src/llm/anthropic-caller.ts`

Uses the `@anthropic-ai/sdk`. Implements:
- `call()` — `client.messages.create()`
- `estimateTokens()` — heuristic: `prompt.length / 4`
- `listModels()` — `client.beta.models.list()` → live Anthropic model list (not hardcoded)

#### `OpenAICompatibleCaller`

**File:** `src/llm/openai-compatible-caller.ts`

A generic caller for any OpenAI-compatible API. Constructor takes `baseURL`, `apiKey`, `providerName`. Uses the `openai` SDK with a custom `baseURL`.

Implements:
- `call()` — `client.chat.completions.create()`
- `estimateTokens()` — heuristic: `prompt.length / 4`
- `listModels()` — `client.models.list()` → works on any `/v1/models` endpoint

Factory functions provided:

| Function | Default baseURL | Provider | Use case |
|----------|----------------|----------|----------|
| `createOllamaCaller(baseURL?)` | `http://localhost:11434/v1` | `"ollama"` | Local Ollama |
| `createOmlxCaller(baseURL?)` | `http://localhost:8000/v1` | `"omlx"` | Local oMLX |
| `createMistralCaller(apiKey)` | `https://api.mistral.ai/v1` | `"mistral"` | Mistral cloud |
| `createGroqCaller(apiKey)` | `https://api.groq.com/openai/v1` | `"groq"` | Groq cloud |
| `createDeepseekCaller(apiKey)` | `https://api.deepseek.com/v1` | `"deepseek"` | Deepseek cloud |

For Ollama cloud, pass a custom baseURL:
```typescript
const ollamaCloud = createOllamaCaller("https://your-cloud-ollama/v1");
```

### 2.4 — Model Discovery / ModelCatalog

**Files:** `src/core/types.ts`, `src/core/interfaces.ts`, `src/core/llm-caller.ts`, `src/core/model-catalog.ts`

The system supports live model discovery across **all** configured callers:

- New type: `DiscoveredModel { provider, modelId, ownedBy }`
- `ILLMCaller` interface extended with `listModels(): Promise<DiscoveredModel[]>`
- `LLMCaller` abstract class requires `listModels()` from subclasses
- `ModelCatalog` class takes `ILLMCaller[]` + static `ModelInfo[]` catalog and produces a merged, deduplicated view via `discoverAll(): Promise<CatalogEntry[]>`

This works uniformly for local servers (Ollama, oMLX) and cloud providers (OpenAI, Anthropic, Google, Mistral, Groq, Deepseek) because they all expose `/v1/models` except Anthropic, which uses `client.beta.models.list()`.


---

## Phase 3: Orchestrator Dependencies

Once at least one `LLMCaller` exists (Phase 2), the two LLM-dependent orchestrator components can be built.

### 3.1 — `ComplexityEstimator` concrete class

**Status:** `IComplexityEstimator` interface exists (extends `IPipelineStep<Task, ComplexityScore>`). No implementation.

**What to build:** Extends `PipelineStep<Task, ComplexityScore>`. Uses an LLM to score task complexity (1–10) with confidence and token estimates.

```typescript
// src/core/complexity-estimator.ts
export class ComplexityEstimator
  extends PipelineStep<Task, ComplexityScore>
  implements IComplexityEstimator
{
  readonly name = "ComplexityEstimator";

  private llmCaller: ILLMCaller;
  private estimatorModel: string;

  constructor(llmCaller: ILLMCaller, estimatorModel: string) {
    super();
    this.llmCaller = llmCaller;
    this.estimatorModel = estimatorModel;
  }

  async execute(task: Task): Promise<ComplexityScore> {
    const span = this.startSpan("estimate");
    const prompt = this.buildPrompt(task);

    const result = await this.llmCaller.callStructured<{
      score: number;
      confidence: number;
      reasoning: string;
      estimatedTokens: { min: number; max: number; expected: number };
    }>(
      prompt,
      {
        model: this.estimatorModel,
        provider: "openai", // config-driven in production
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 500,
      },
      {},
    );

    this.endSpan(span!, { score: result.score, confidence: result.confidence });
    return {
      score: Math.max(1, Math.min(10, result.score)),
      confidence: Math.max(0, Math.min(1, result.confidence)),
      reasoning: result.reasoning,
      estimatedTokens: result.estimatedTokens,
    };
  }

  private buildPrompt(task: Task): string {
    return `Analyze the complexity of this task:

Description: ${task.description}
Context: ${JSON.stringify(task.context)}
Priority: ${task.priority}
Constraints: ${JSON.stringify(task.constraints ?? {})}

Return a JSON object with:
- score: 1-10 (1=trivial lookup, 5=moderate reasoning, 10=multi-step research/creation)
- confidence: 0-1 (how confident you are in this score)
- reasoning: brief explanation
- estimatedTokens: { min, max, expected } — your estimate of total tokens needed to complete this task`;
  }
}

const SYSTEM_PROMPT = `You are a task complexity analyzer. Score tasks from 1 (trivial) to 10 (extremely complex). Consider: ambiguity, domain knowledge required, number of steps, need for external data, and reasoning depth. Be conservative — prefer slightly higher scores.`;
```

**Dependencies:** `PipelineStep<Task, ComplexityScore>` — exists. `ILLMCaller` — interface exists, concrete implementation needed (Phase 2). `Task`, `ComplexityScore`, `TokenEstimate` — exist in `types.ts`.

**File:** `src/core/complexity-estimator.ts`

---

### 3.2 — `TaskDecomposer` concrete class

**Status:** `ITaskDecomposer` interface exists. No implementation.

**What to build:** Uses an LLM to split a complex task into a DAG of `SubTask[]`. Each sub-task gets its own complexity score, capability tags, and dependency list.

```typescript
// src/core/task-decomposer.ts
export class TaskDecomposer implements ITaskDecomposer {
  private llmCaller: ILLMCaller;
  private decomposerModel: string;

  constructor(llmCaller: ILLMCaller, decomposerModel: string) {
    this.llmCaller = llmCaller;
    this.decomposerModel = decomposerModel;
  }

  async decompose(task: Task, score: ComplexityScore): Promise<SubTask[]> {
    const prompt = this.buildPrompt(task, score);

    const raw = await this.llmCaller.callStructured<{
      subTasks: Array<{
        description: string;
        capabilityTags: string[];
        dependencies: number[]; // 0-based indices into subTasks array
        complexity: { score: number; confidence: number; reasoning: string; estimatedTokens: { min: number; max: number; expected: number } };
      }>;
    }>(
      prompt,
      {
        model: this.decomposerModel,
        provider: "openai",
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.2,
        maxTokens: 2000,
      },
      {},
    );

    return raw.subTasks.map((st, i) => ({
      id: `${task.id}-sub-${i}`,
      parentTaskId: task.id,
      description: st.description,
      context: task.context,
      dependencies: st.dependencies.map((d) => `${task.id}-sub-${d}`),
      capabilityTags: st.capabilityTags,
      complexity: {
        score: Math.max(1, Math.min(10, st.complexity.score)),
        confidence: Math.max(0, Math.min(1, st.complexity.confidence)),
        reasoning: st.complexity.reasoning,
        estimatedTokens: st.complexity.estimatedTokens,
      },
      priority: task.priority,
    }));
  }

  private buildPrompt(task: Task, score: ComplexityScore): string {
    return `Decompose this complex task (scored ${score.score}/10) into smaller sub-tasks:

Task: ${task.description}
Context: ${JSON.stringify(task.context)}
Constraints: ${JSON.stringify(task.constraints ?? {})}

Rules:
- Each sub-task should be independently executable by a single-purpose agent
- Specify capability tags for each sub-task (e.g., "search", "codebase", "analysis", "summarization", "file-io", "execution")
- Define dependencies as 0-based indices (sub-task 2 depends on sub-task 0 means dependencies: [0])
- Each sub-task gets its own complexity score (should be lower than the parent's ${score.score})
- Aim for 2-5 sub-tasks

Return JSON: { "subTasks": [...] }`;
  }
}

const SYSTEM_PROMPT = `You are a task decomposition specialist. Break complex tasks into the smallest possible independent sub-tasks. Each sub-task should be simple enough for a single-purpose agent. Prefer more, simpler sub-tasks over fewer, complex ones.`;
```

**Dependencies:** `ITaskDecomposer` — exists. `ILLMCaller` — needs concrete implementation (Phase 2). `Task`, `ComplexityScore`, `SubTask` — exist in `types.ts`.

**File:** `src/core/task-decomposer.ts`

---

## Phase 4: Concrete Agents

Once at least one `LLMCaller` exists (Phase 2), concrete agents can be built. Each agent extends the `Agent` abstract class and implements three methods: `buildPrompt()`, `buildSystemPrompt()`, `parseOutput()`.

### Agent Design Principles

- **Single responsibility**: one job, one prompt, one output format
- **Minimal prompt**: as short as possible to minimize token usage
- **Declared manifest**: tags, complexity range, token profile, preferred models
- **Stateless**: all context comes from `SubTask.context`

### 4.1 — `SearchAgent`

**Purpose:** Searches a codebase or knowledge base for relevant information.

```typescript
// src/agents/search-agent.ts
export class SearchAgent extends Agent {
  readonly manifest: AgentManifest = {
    id: "search-agent",
    tags: ["search", "codebase", "read-only"],
    complexityRange: [1, 4],
    tokenProfile: { min: 200, max: 2000, typical: 800 },
    preferredModels: ["gpt-4o-mini", "claude-haiku", "gemini-flash"],
    timeoutMs: 30000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Search for: ${subTask.description}\nContext: ${JSON.stringify(subTask.context)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a codebase search agent. Find relevant files, functions, and patterns. Return precise file paths and line numbers when possible.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { findings: raw };
  }
}
```

### 4.2 — `AnalysisAgent`

**Purpose:** Analyzes code, data, or text for patterns, issues, or insights.

```typescript
// src/agents/analysis-agent.ts
export class AnalysisAgent extends Agent {
  readonly manifest: AgentManifest = {
    id: "analysis-agent",
    tags: ["analysis", "reasoning"],
    complexityRange: [3, 7],
    tokenProfile: { min: 500, max: 4000, typical: 1500 },
    preferredModels: ["gpt-4o", "claude-sonnet", "gemini-pro"],
    timeoutMs: 60000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Analyze: ${subTask.description}\nData: ${JSON.stringify(subTask.context)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code and data analysis agent. Identify patterns, issues, risks, and opportunities. Be thorough and precise.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { analysis: raw };
  }
}
```

### 4.3 — `SummarizerAgent`

**Purpose:** Summarizes findings, results, or documents into concise output.

```typescript
// src/agents/summarizer-agent.ts
export class SummarizerAgent extends Agent {
  readonly manifest: AgentManifest = {
    id: "summarizer-agent",
    tags: ["summarization", "synthesis"],
    complexityRange: [1, 5],
    tokenProfile: { min: 200, max: 1500, typical: 600 },
    preferredModels: ["gpt-4o-mini", "claude-haiku", "gemini-flash"],
    timeoutMs: 30000,
    maxRetries: 1,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Summarize the following:\n${JSON.stringify(subTask.context)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a summarization agent. Produce concise, accurate summaries. Preserve key facts, omit filler.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { summary: raw };
  }
}
```

### 4.4 — `ExecutorAgent`

**Purpose:** Generates and executes code, commands, or actions.

```typescript
// src/agents/executor-agent.ts
export class ExecutorAgent extends Agent {
  readonly manifest: AgentManifest = {
    id: "executor-agent",
    tags: ["execution", "code-generation", "write"],
    complexityRange: [3, 8],
    tokenProfile: { min: 500, max: 8000, typical: 2000 },
    preferredModels: ["gpt-4o", "claude-sonnet"],
    timeoutMs: 120000,
    maxRetries: 1,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `Execute: ${subTask.description}\nContext: ${JSON.stringify(subTask.context)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a code execution agent. Generate working code, commands, or actions. Be precise and safe.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { code: raw };
  }
}
```

### 4.5 — `FileIOAgent`

**Purpose:** Reads, writes, and manipulates files.

```typescript
// src/agents/file-io-agent.ts
export class FileIOAgent extends Agent {
  readonly manifest: AgentManifest = {
    id: "file-io-agent",
    tags: ["file-io", "read-only", "write"],
    complexityRange: [1, 3],
    tokenProfile: { min: 100, max: 1000, typical: 400 },
    preferredModels: ["gpt-4o-mini", "claude-haiku", "gemini-flash"],
    timeoutMs: 15000,
    maxRetries: 2,
  };

  readonly llmCaller: ILLMCaller;

  constructor(llmCaller: ILLMCaller) {
    super();
    this.llmCaller = llmCaller;
  }

  protected buildPrompt(subTask: SubTask): string {
    return `File operation: ${subTask.description}\nContext: ${JSON.stringify(subTask.context)}`;
  }

  protected buildSystemPrompt(_subTask: SubTask): string {
    return "You are a file I/O agent. Read, write, and list files. Return file contents or operation results.";
  }

  protected parseOutput(raw: string, _subTask: SubTask): unknown {
    return { result: raw };
  }
}
```

**Files:** `src/agents/search-agent.ts`, `src/agents/analysis-agent.ts`, `src/agents/summarizer-agent.ts`, `src/agents/executor-agent.ts`, `src/agents/file-io-agent.ts`

---

## Phase 5: Inbound Layer

### 5.1 — `Subject<T>` (Observable implementation)

Already described in Phase 1.1. **File:** `src/core/observable.ts`

### 5.2 — Sensors (5)

Each sensor implements `ISensor` and uses `Subject<RawSignal>` to emit signals.

#### `CronSensor` (simplest — no external SDK)

```typescript
// src/sensors/cron-sensor.ts
export class CronSensor implements ISensor {
  readonly channel = "cron";
  readonly signals = new Subject<RawSignal>();

  private intervalId?: NodeJS.Timeout;
  private scheduleMs: number;
  private description: string;

  constructor(scheduleMs: number, description: string) {
    this.scheduleMs = scheduleMs;
    this.description = description;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.signals.next({
        channel: "cron",
        payload: { description: this.description },
        receivedAt: Date.now(),
        metadata: { schedule: this.scheduleMs },
      });
    }, this.scheduleMs);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
```

#### `WebhookSensor` (needs HTTP server — express/fastify)

```bash
npm install express
npm install -D @types/express
```

```typescript
// src/sensors/webhook-sensor.ts
import express from "express";

export class WebhookSensor implements ISensor {
  readonly channel = "webhook";
  readonly signals = new Subject<RawSignal>();

  private app = express();
  private server?: ReturnType<typeof this.app.listen>;
  private port: number;
  private path: string;

  constructor(port: number, path: string = "/webhook") {
    this.port = port;
    this.path = path;
    this.app.use(express.json());
  }

  start(): void {
    this.app.post(this.path, (req, res) => {
      this.signals.next({
        channel: "webhook",
        payload: { body: req.body, headers: req.headers },
        receivedAt: Date.now(),
        metadata: {
          callbackUrl: req.headers["x-callback-url"] as string,
          requestId: req.headers["x-request-id"] as string,
        },
      });
      res.status(202).json({ accepted: true });
    });

    this.server = this.app.listen(this.port);
  }

  stop(): void {
    this.server?.close();
  }
}
```

#### `EmailSensor`, `SlackSensor`, `FileWatcherSensor`

These require external SDKs (IMAP client, Slack SDK, chokidar for file watching). They follow the same pattern: poll or listen, emit `RawSignal` on each event.

**Files:** `src/sensors/cron-sensor.ts`, `src/sensors/webhook-sensor.ts`, `src/sensors/email-sensor.ts`, `src/sensors/slack-sensor.ts`, `src/sensors/filesystem-sensor.ts`

### 5.3 — SignalAdapters (5)

Already described in Phase 1.5. **Files:** `src/adapters/*.ts`

### 5.4 — TaskFactory

Already described in Phase 1.4. **File:** `src/core/task-factory.ts`

### 5.5 — Prioritizer

Already described in Phase 1.3. **File:** `src/core/prioritizer.ts`

### 5.6 — TaskQueue

Already described in Phase 1.6. **File:** `src/core/task-queue.ts`

---

## Phase 6: Outbound Layer

### 6.1 — Responders (5)

Already described in Phase 1.8. Initial versions stub the transport. Real transport is added when external SDKs are integrated.

**Files:** `src/responders/email-responder.ts`, `src/responders/slack-responder.ts`, `src/responders/webhook-responder.ts`, `src/responders/cron-responder.ts`, `src/responders/filesystem-responder.ts`

---

## Phase 7: Wiring & Entrypoint

### 7.1 — Config Loading

Load `FactoryConfig` from a JSON file or environment variables.

```typescript
// src/core/config-loader.ts
import { readFileSync } from "node:fs";

export function loadConfig(path: string): FactoryConfig {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as FactoryConfig;
}
```

Example config file (`factory.config.json`):
```json
{
  "complexity": {
    "decompositionThreshold": 5,
    "estimatorModel": "gpt-4o-mini"
  },
  "budget": {
    "defaultCap": 10.0,
    "softCapRatio": 0.8
  },
  "dispatch": {
    "maxConcurrency": 5,
    "defaultTimeoutMs": 120000
  },
  "models": [
    {
      "provider": "openai",
      "modelId": "gpt-4o-mini",
      "maxTokens": 128000,
      "costPer1kInput": 0.00015,
      "costPer1kOutput": 0.0006,
      "capabilities": ["search", "analysis", "summarization", "execution", "code-generation", "file-io", "read-only", "write", "reasoning", "synthesis"]
    },
    {
      "provider": "openai",
      "modelId": "gpt-4o",
      "maxTokens": 128000,
      "costPer1kInput": 0.0025,
      "costPer1kOutput": 0.01,
      "capabilities": ["analysis", "execution", "code-generation", "reasoning", "synthesis"]
    },
    {
      "provider": "anthropic",
      "modelId": "claude-haiku-3-5",
      "maxTokens": 200000,
      "costPer1kInput": 0.0008,
      "costPer1kOutput": 0.004,
      "capabilities": ["search", "analysis", "summarization", "execution", "code-generation", "file-io", "read-only", "write", "reasoning", "synthesis"]
    },
    {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4",
      "maxTokens": 200000,
      "costPer1kInput": 0.003,
      "costPer1kOutput": 0.015,
      "capabilities": ["analysis", "execution", "code-generation", "reasoning", "synthesis"]
    },
    {
      "provider": "google",
      "modelId": "gemini-flash-2.5",
      "maxTokens": 1048576,
      "costPer1kInput": 0.00015,
      "costPer1kOutput": 0.0006,
      "capabilities": ["search", "analysis", "summarization", "execution", "code-generation", "file-io", "read-only", "write", "reasoning", "synthesis"]
    }
  ],
  "agents": [
    {
      "id": "search-agent",
      "tags": ["search", "codebase", "read-only"],
      "complexityRange": [1, 4],
      "tokenProfile": { "min": 200, "max": 2000, "typical": 800 },
      "preferredModels": ["gpt-4o-mini", "claude-haiku-3-5", "gemini-flash-2.5"],
      "timeoutMs": 30000,
      "maxRetries": 2
    },
    {
      "id": "analysis-agent",
      "tags": ["analysis", "reasoning"],
      "complexityRange": [3, 7],
      "tokenProfile": { "min": 500, "max": 4000, "typical": 1500 },
      "preferredModels": ["gpt-4o", "claude-sonnet-4"],
      "timeoutMs": 60000,
      "maxRetries": 2
    },
    {
      "id": "summarizer-agent",
      "tags": ["summarization", "synthesis"],
      "complexityRange": [1, 5],
      "tokenProfile": { "min": 200, "max": 1500, "typical": 600 },
      "preferredModels": ["gpt-4o-mini", "claude-haiku-3-5", "gemini-flash-2.5"],
      "timeoutMs": 30000,
      "maxRetries": 1
    },
    {
      "id": "executor-agent",
      "tags": ["execution", "code-generation", "write"],
      "complexityRange": [3, 8],
      "tokenProfile": { "min": 500, "max": 8000, "typical": 2000 },
      "preferredModels": ["gpt-4o", "claude-sonnet-4"],
      "timeoutMs": 120000,
      "maxRetries": 1
    },
    {
      "id": "file-io-agent",
      "tags": ["file-io", "read-only", "write"],
      "complexityRange": [1, 3],
      "tokenProfile": { "min": 100, "max": 1000, "typical": 400 },
      "preferredModels": ["gpt-4o-mini", "claude-haiku-3-5", "gemini-flash-2.5"],
      "timeoutMs": 15000,
      "maxRetries": 2
    }
  ]
}
```

### 7.2 — `Factory` class (main entrypoint)

The `Factory` class wires everything together: loads config, creates all components, starts sensors, and runs the main loop.

```typescript
// src/factory.ts
export class AIFactory {
  private eventBus: EventBus;
  private tracer: Tracer;
  private budgetTracker: BudgetTracker;
  private agentRegistry: AgentRegistry;
  private orchestrator: Orchestrator;
  private sensors: ISensor[] = [];
  private adapters = new Map<string, ISignalAdapter>();
  private responders = new Map<string, IResponder>();
  private taskFactory: ITaskFactory;
  private prioritizer: IPrioritizer;
  private taskQueue: ITaskQueue;
  private running = false;

  constructor(config: FactoryConfig) {
    // Cross-cutting
    this.eventBus = new EventBus();
    this.tracer = new Tracer();

    // Budget
    this.budgetTracker = new BudgetTracker(this.eventBus);
    this.budgetTracker.loadConfig({
      defaultCap: config.budget.defaultCap,
      softCapRatio: config.budget.softCapRatio,
    });
    const providers = [...new Set(config.models.map((m) => m.provider))];
    this.budgetTracker.initialize(providers);

    // Agent registry
    this.agentRegistry = new AgentRegistry(this.eventBus);
    for (const manifest of config.agents) {
      this.agentRegistry.register(manifest);
    }

    // LLM callers (one per provider)
    const llmCallers = new Map<string, ILLMCaller>();
    // TODO: create concrete LLMCallers from config + secrets

    // Agents
    const agents = new Map<string, IAgent>();
    // TODO: instantiate concrete agents with llmCallers

    // Orchestrator dependencies
    const estimator = new ComplexityEstimator(/* llmCaller */, config.complexity.estimatorModel);
    const decomposer = new TaskDecomposer(/* llmCaller */, "gpt-4o-mini");
    const modelSelector = new ModelSelector(config.models);
    const dispatcher = new Dispatcher(
      this.agentRegistry,
      agents,
      config.dispatch.maxConcurrency,
    );
    const aggregator = new Aggregator();

    // Orchestrator
    this.orchestrator = new Orchestrator({
      estimator,
      decomposer,
      modelSelector,
      dispatcher,
      aggregator,
      budgetTracker: this.budgetTracker,
      eventBus: this.eventBus,
      tracer: this.tracer,
      decompositionThreshold: config.complexity.decompositionThreshold,
    });

    // Inbound
    this.taskFactory = new TaskFactory();
    this.prioritizer = new Prioritizer();
    this.taskQueue = new InMemoryTaskQueue();
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

  async start(): Promise<void> {
    this.running = true;

    // Start all sensors
    for (const sensor of this.sensors) {
      sensor.signals.subscribe((raw) => this.onSignal(raw));
      sensor.start();
    }

    // Main processing loop
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
    this.budgetTracker.destroy();
  }

  private async onSignal(raw: RawSignal): Promise<void> {
    const adapter = this.adapters.get(raw.channel);
    if (!adapter) {
      console.warn(`No adapter for channel: ${raw.channel}`);
      return;
    }
    const signal = adapter.adapt(raw);
    const task = this.taskFactory.create(signal);
    await this.taskQueue.enqueue(task);
  }

  private async deliverResult(result: FinalResult, task: Task): Promise<void> {
    const responder = this.responders.get(task.origin.channel);
    if (!responder) {
      console.warn(`No responder for channel: ${task.origin.channel}`);
      return;
    }
    await responder.respond(result, task);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**File:** `src/factory.ts`

### 7.3 — Main entrypoint (`src/index.ts`)

```typescript
// src/index.ts
import { loadConfig } from "./core/config-loader.js";
import { AIFactory } from "./factory.js";

async function main() {
  const config = loadConfig("./factory.config.json");
  const factory = new AIFactory(config);

  // Register adapters
  factory.registerAdapter(new EmailAdapter());
  factory.registerAdapter(new SlackAdapter());
  factory.registerAdapter(new WebhookAdapter());
  factory.registerAdapter(new CronAdapter());
  factory.registerAdapter(new FileSystemAdapter());

  // Register responders
  factory.registerResponder(new EmailResponder());
  factory.registerResponder(new SlackResponder());
  factory.registerResponder(new WebhookResponder());
  factory.registerResponder(new CronResponder());
  factory.registerResponder(new FileSystemResponder());

  // Register sensors
  factory.registerSensor(new CronSensor(3600000, "Hourly health check"));
  factory.registerSensor(new WebhookSensor(3000, "/webhook"));

  // Start
  await factory.start();
}

main().catch(console.error);
```

**File:** `src/index.ts`

---

## Phase 8: Supporting Infrastructure

### 8.1 — Logging

Add a structured logger. Options: `pino`, `winston`, or a simple custom logger.

```typescript
// src/core/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = "info") {}

  debug(msg: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) console.debug(msg, meta ?? "");
  }
  info(msg: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) console.info(msg, meta ?? "");
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) console.warn(msg, meta ?? "");
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) console.error(msg, meta ?? "");
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ["debug", "info", "warn", "error"];
    return order.indexOf(level) >= order.indexOf(this.level);
  }
}
```

### 8.2 — Metrics Collector

Subscribe to EventBus events and aggregate metrics.

```typescript
// src/core/metrics.ts
export class MetricsCollector {
  private taskCount = 0;
  private taskSuccessCount = 0;
  private totalTokens = 0;
  private totalCost = 0;
  private latencySamples: number[] = [];
  private modelUsage = new Map<string, number>();

  constructor(eventBus: IEventBus) {
    eventBus.on("task:completed", (e) => {
      this.taskCount++;
      this.taskSuccessCount++;
      this.totalTokens += (e.payload.totalTokens as number) ?? 0;
      this.totalCost += (e.payload.totalCost as number) ?? 0;
      this.latencySamples.push((e.payload.totalLatencyMs as number) ?? 0);
    });
    eventBus.on("task:failed", () => {
      this.taskCount++;
    });
    eventBus.on("token:consumed", (e) => {
      const model = e.payload.provider as string;
      const tokens = (e.payload.tokens as number) ?? 0;
      this.modelUsage.set(model, (this.modelUsage.get(model) ?? 0) + tokens);
    });
  }

  getStats() {
    return {
      tasks: { total: this.taskCount, succeeded: this.taskSuccessCount },
      tokens: { total: this.totalTokens, byModel: Object.fromEntries(this.modelUsage) },
      cost: { total: this.totalCost },
      latency: {
        avg: this.latencySamples.length > 0
          ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
          : 0,
        p95: this.percentile(95),
        p99: this.percentile(99),
      },
    };
  }

  private percentile(p: number): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[idx]!;
  }
}
```

### 8.3 — Rate Limiter

Token-bucket rate limiter for LLM API calls.

```typescript
// src/core/rate-limiter.ts
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    const waitMs = (1 / this.refillRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

### 8.4 — Circuit Breaker

Stateful circuit breaker for LLM provider calls.

```typescript
// src/core/circuit-breaker.ts
type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private openUntil = 0;

  constructor(
    private failureThreshold: number,
    private resetTimeoutMs: number,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() < this.openUntil) {
        throw new Error("Circuit breaker is open");
      }
      this.state = "half-open";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
      this.openUntil = Date.now() + this.resetTimeoutMs;
    }
  }
}
```

### 8.5 — Health Checks

```typescript
// src/core/health.ts
export interface HealthStatus {
  healthy: boolean;
  components: Record<string, { healthy: boolean; detail?: string }>;
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<boolean>>();

  register(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async check(): Promise<HealthStatus> {
    const components: HealthStatus["components"] = {};
    let allHealthy = true;

    for (const [name, check] of this.checks) {
      try {
        const healthy = await check();
        components[name] = { healthy };
        if (!healthy) allHealthy = false;
      } catch (err) {
        components[name] = { healthy: false, detail: String(err) };
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, components };
  }
}
```

---

## Phase 9: Real-World Integrations

Phase 8 infrastructure can be built incrementally before tackling this section.

### 9.1 — Real Inbound Sensors

Replace stub sensors with real network/file-system integrations:

- **`WebhookSensor`** — start an actual HTTP server (e.g., Express or Node built-in `http`) and emit `RawSignal` from incoming POSTs.
- **`EmailSensor`** — poll an IMAP inbox or listen for new messages.
- **`SlackSensor`** — run a Slack Bolt app and emit signals from mentions/DMs.
- **`FileWatcherSensor`** — watch a directory with `chokidar` and emit signals on file changes.

### 9.2 — Real Outbound Responders

Replace console-log stubs with real transport:

- **`EmailResponder`** — send email via `nodemailer`.
- **`SlackResponder`** — post messages via Slack web API or Bolt client.
- **`WebhookResponder`** — perform real HTTP POST callbacks.
- **`FileSystemResponder`** — write results to disk.

### 9.3 — Tests (complete)

The test framework and inventory are already in place.

```bash
npm install -D vitest
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Add `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

#### Test Inventory

| Phase | Component | Test File | Dependencies |
|-------|-----------|-----------|-------------|
| 1 | `EventBus` | `src/core/__tests__/event-bus.test.ts` | None |
| 1 | `Tracer` | `src/core/__tests__/tracer.test.ts` | None |
| 1 | `InMemoryRepository` | `src/core/__tests__/repository.test.ts` | None |
| 1 | `BudgetTracker` | `src/core/__tests__/budget-tracker.test.ts` | Mock EventBus |
| 1 | `AgentRegistry` | `src/core/__tests__/agent-registry.test.ts` | Mock EventBus |
| 1 | `Dispatcher` | `src/core/__tests__/dispatcher.test.ts` | Mock AgentRegistry, Mock Agents |
| 1 | `Aggregator` | `src/core/__tests__/aggregator.test.ts` | None |
| 1 | `Prioritizer` | `src/core/__tests__/prioritizer.test.ts` | None |
| 1 | `TaskFactory` | `src/core/__tests__/task-factory.test.ts` | None |
| 1 | `Subject<T>` | `src/core/__tests__/observable.test.ts` | None |
| 1 | `ModelSelector` | `src/core/__tests__/model-selector.test.ts` | None |
| 1 | `TaskQueue` | `src/core/__tests__/task-queue.test.ts` | None |
| 1 | SignalAdapters (5) | `src/adapters/__tests__/*.test.ts` | None |
| 1 | Responders (5) | `src/responders/__tests__/*.test.ts` | None |
| 3 | `ComplexityEstimator` | `src/core/__tests__/complexity-estimator.test.ts` | Mock LLMCaller |
| 3 | `TaskDecomposer` | `src/core/__tests__/task-decomposer.test.ts` | Mock LLMCaller |
| 4 | Agents (5) | `src/agents/__tests__/*.test.ts` | Mock LLMCaller |
| 7 | `Orchestrator` | `src/core/__tests__/orchestrator.test.ts` | Mock all 5 deps |
| 7 | `AIFactory` | `src/__tests__/factory.test.ts` | Full integration |

---

## External Dependencies (npm packages)

### Required for Phase 2 (LLM Providers)

```bash
npm install openai @anthropic-ai/sdk @google/generative-ai
```

### Required for Phase 5 (Sensors)

```bash
npm install express        # WebhookSensor
npm install -D @types/express
npm install imap            # EmailSensor (or node-imap)
npm install -D @types/imap
npm install @slack/bolt     # SlackSensor
npm install chokidar        # FileWatcherSensor
```

### Required for Phase 6 (Responders — real transport)

```bash
npm install nodemailer      # EmailResponder
npm install -D @types/nodemailer
# Slack SDK already installed for sensor
```

### Required for Phase 8 (Infrastructure)

```bash
npm install pino            # Structured logging (optional — ConsoleLogger is zero-dep)
```

### Required for Phase 9 (Real-World Integrations)

```bash
npm install express imap @slack/bolt chokidar nodemailer
npm install -D @types/express @types/imap @types/nodemailer
```

`vitest` is already installed from Phase 7.

---

## Master Checklist

### Phase 1 — Zero Dependencies (done)

- [x] `Subject<T>` — `src/core/observable.ts`
- [x] `Aggregator` — `src/core/aggregator.ts`
- [x] `Prioritizer` — `src/core/prioritizer.ts`
- [x] `TaskFactory` — `src/core/task-factory.ts`
- [x] `EmailAdapter` — `src/adapters/email-adapter.ts`
- [x] `SlackAdapter` — `src/adapters/slack-adapter.ts`
- [x] `WebhookAdapter` — `src/adapters/webhook-adapter.ts`
- [x] `CronAdapter` — `src/adapters/cron-adapter.ts`
- [x] `FileSystemAdapter` — `src/adapters/filesystem-adapter.ts`
- [x] `ITaskQueue` + `InMemoryTaskQueue` — `src/core/task-queue.ts`
- [x] `ModelSelector` — `src/core/model-selector.ts`
- [x] `EmailResponder` (stub) — `src/responders/email-responder.ts`
- [x] `SlackResponder` (stub) — `src/responders/slack-responder.ts`
- [x] `WebhookResponder` (stub) — `src/responders/webhook-responder.ts`
- [x] `CronResponder` (stub) — `src/responders/cron-responder.ts`
- [x] `FileSystemResponder` (stub) — `src/responders/filesystem-responder.ts`
- [x] `ConfigLoader` — `src/core/config-loader.ts`
- [x] `factory.config.json` — example config file
- [x] Unit tests for EventBus, Repository, BudgetTracker, AgentRegistry, Dispatcher, Aggregator, Prioritizer, TaskFactory, Subject, ModelSelector, TaskQueue, Adapters
- [x] Unit tests for Tracer, Responders

### Phase 2 — LLM Providers (partially complete)

- [x] `npm install openai @anthropic-ai/sdk` (Google SDK not installed yet)
- [x] `SecretsProvider` + `EnvSecretsProvider` — `src/core/secrets.ts`
- [x] `OpenAICaller` — `src/llm/openai-caller.ts` (with `listModels()`)
- [x] `AnthropicCaller` — `src/llm/anthropic-caller.ts` (with dynamic `listModels()` via `client.beta.models.list()`)
- [x] `GoogleCaller` — `src/llm/google-caller.ts` (Gemini OpenAI-compatible endpoint; reuses `openai` package)
- [x] `OpenAICompatibleCaller` + factory functions — `src/llm/openai-compatible-caller.ts` (Ollama, oMLX port 8000, Mistral, Groq, Deepseek; all with `listModels()`)
- [x] `DiscoveredModel` type and `ModelCatalog` — `src/core/model-catalog.ts`
- [x] Unit tests for OpenAICaller, AnthropicCaller, GoogleCaller, OpenAICompatibleCaller
- [x] Unit tests for ModelCatalog
- [x] Unit tests for all 5 Agents
- [x] Unit tests for Tracer, Responders

### Phase 3 — Orchestrator Dependencies (done)

- [x] `ComplexityEstimator` — `src/core/complexity-estimator.ts`
- [x] `TaskDecomposer` — `src/core/task-decomposer.ts`
- [x] Unit tests for both — `src/core/__tests__/complexity-estimator.test.ts`, `src/core/__tests__/task-decomposer.test.ts`

### Phase 4 — Concrete Agents (done)

- [x] `SearchAgent` — `src/agents/search-agent.ts`
- [x] `AnalysisAgent` — `src/agents/analysis-agent.ts`
- [x] `SummarizerAgent` — `src/agents/summarizer-agent.ts`
- [x] `ExecutorAgent` — `src/agents/executor-agent.ts`
- [x] `FileIOAgent` — `src/agents/file-io-agent.ts`
- [x] Unit tests for all 5 agents — `src/agents/__tests__/agents.test.ts`

### Phase 5 — Inbound Layer (partially complete)

- [ ] `npm install express imap @slack/bolt chokidar` + type packages
- [x] `CronSensor` — `src/sensors/cron-sensor.ts`
- [x] `WebhookSensor` (stub) — `src/sensors/webhook-sensor.ts`
- [ ] `EmailSensor` — `src/sensors/email-sensor.ts`
- [ ] `SlackSensor` — `src/sensors/slack-sensor.ts`
- [ ] `FileWatcherSensor` — `src/sensors/filesystem-sensor.ts`

### Phase 6 — Outbound Layer (needs Phase 1 + npm install for real transport)

- [ ] `npm install nodemailer` + types
- [ ] Replace stubs in Responders with real transport

### Phase 7 — Wiring (done)

- [x] `AIFactory` class — `src/factory.ts`
- [x] `src/index.ts` — barrel export
- [x] `src/main.ts` — runtime entrypoint
- [x] Integration test — src/__tests__/factory.test.ts

### Phase 8 — Infrastructure (in progress)

- [x] `Logger` + `ConsoleLogger` + `NoopLogger` — `src/core/logger.ts`
- [x] `RateLimiter` — `src/core/rate-limiter.ts`
- [x] `CircuitBreaker` + `ResilientLLMCaller` — `src/core/circuit-breaker.ts`, `src/core/resilient-llm-caller.ts`
- [ ] `MetricsCollector` — `src/core/metrics.ts`
- [ ] `HealthChecker` — `src/core/health.ts`
- [ ] DB-backed `IRepository` implementation (SQLite/PostgreSQL)

### Phase 9 — Real-World Integrations

- [ ] Real `WebhookSensor` HTTP server
- [ ] `EmailSensor`
- [ ] `SlackSensor`
- [ ] `FileWatcherSensor`
- [ ] Real `EmailResponder` via nodemailer
- [ ] Real `SlackResponder`
- [ ] Real `WebhookResponder` HTTP callbacks
- [ ] Real `FileSystemResponder` disk writes

### Tests (complete)

- [x] `npm install -D vitest`
- [x] `vitest.config.ts`
- [x] Unit tests for Phase 1 zero-dependency components (71 tests passing)
- [x] Unit tests for LLM callers, ModelCatalog, all 5 Agents, Tracer, Responders, Orchestrator dependencies, AIFactory integration, Logger, RateLimiter, CircuitBreaker (84 tests passing)
