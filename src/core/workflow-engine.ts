import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  IAgent,
  IEventBus,
  IModelSelector,
  ITracer,
  IBudgetTracker,
} from "./interfaces.js";
import type {
  ConversationTurn,
  FinalResult,
  ModelChoice,
  SubTask,
  Task,
  TaskResult,
  TokenEstimate,
  TokenUsage,
} from "./types.js";
import type {
  HumanApprovalDecision,
  WorkflowArtifactKind,
  WorkflowArtifactRecord,
  HumanTaskRecord,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
  WorkflowStepRunState,
} from "./workflow-types.js";
import type {
  IWorkflowArtifactRepository,
  IHumanTaskRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "./workflow-repository.js";
import { PipelineStep, type PipelineContext } from "./pipeline-step.js";

interface WorkflowPause {
  humanTask: HumanTaskRecord;
  stepId: string;
}

interface WorkflowStepResolution {
  definition: WorkflowDefinition;
  step: WorkflowStep;
  prefix: string;
  effectiveStepId: string;
}

export class WorkflowEngine extends PipelineStep<Task, FinalResult> {
  readonly name = "WorkflowEngine";

  private readonly workflowRepository: IWorkflowRepository;
  private readonly workflowRunRepository: IWorkflowRunRepository;
  private readonly humanTaskRepository: IHumanTaskRepository;
  private readonly artifactRepository?: IWorkflowArtifactRepository;
  private readonly artifactRootDir: string;
  private readonly agents: Map<string, IAgent>;
  private readonly modelSelector: IModelSelector;
  private readonly budgetTracker: IBudgetTracker;
  private readonly onConversationAppended?: (taskId: string, conversation: ConversationTurn[]) => Promise<void>;

  constructor(deps: {
    workflowRepository: IWorkflowRepository;
    workflowRunRepository: IWorkflowRunRepository;
    humanTaskRepository: IHumanTaskRepository;
    artifactRepository?: IWorkflowArtifactRepository;
    artifactRootDir?: string;
    agents: Map<string, IAgent>;
    modelSelector: IModelSelector;
    budgetTracker: IBudgetTracker;
    eventBus: IEventBus;
    tracer: ITracer;
    onConversationAppended?: (taskId: string, conversation: ConversationTurn[]) => Promise<void>;
  }) {
    super();
    this.workflowRepository = deps.workflowRepository;
    this.workflowRunRepository = deps.workflowRunRepository;
    this.humanTaskRepository = deps.humanTaskRepository;
    this.artifactRepository = deps.artifactRepository;
    this.artifactRootDir = deps.artifactRootDir ?? join(process.cwd(), "out", "artifacts");
    this.agents = deps.agents;
    this.modelSelector = deps.modelSelector;
    this.budgetTracker = deps.budgetTracker;
    this.onConversationAppended = deps.onConversationAppended;

    const trace = deps.tracer.startTrace("workflow-engine-init");
    const ctx: PipelineContext = {
      eventBus: deps.eventBus,
      tracer: deps.tracer,
      traceId: trace.traceId,
    };
    this.setContext(ctx);
  }

  async execute(task: Task): Promise<FinalResult> {
    if (!task.workflow?.workflowId) {
      throw new Error(`Task ${task.id} does not reference a workflow`);
    }

    const definition = await this.workflowRepository.get(
      task.workflow.workflowId,
      task.workflow.workflowVersion,
    );

    if (!definition) {
      throw new Error(`Workflow ${task.workflow.workflowId} not found`);
    }

    const now = Date.now();
    const run: WorkflowRun = {
      id: crypto.randomUUID(),
      workflowId: definition.id,
      workflowVersion: definition.version,
      taskId: task.id,
      status: "running",
      currentStepId: undefined,
      context: {
        taskDescription: task.description,
        taskContext: task.context,
      },
      stepStates: {},
      createdAt: now,
      updatedAt: now,
    };
    await this.workflowRunRepository.save(run);

    try {
      const pause = await this.executeDefinition(definition, task, run, "");
      if (pause) {
        run.status = "waiting_for_human";
        run.currentStepId = pause.stepId;
        run.updatedAt = Date.now();
        await this.workflowRunRepository.save(run);

        return this.buildFinalResult(task, this.extractAgentResults(run), {
          waitingForHuman: true,
          workflowRunId: run.id,
          humanTaskId: pause.humanTask.id,
          stepId: pause.stepId,
          workflowId: definition.id,
          workflowVersion: definition.version,
        });
      }

      run.status = "completed";
      run.currentStepId = undefined;
      run.updatedAt = Date.now();
      run.completedAt = run.updatedAt;
      await this.workflowRunRepository.save(run);

      return this.buildFinalResult(task, this.extractAgentResults(run), {
        workflowRunId: run.id,
        workflowId: definition.id,
        workflowVersion: definition.version,
        context: run.context,
      }, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run.status = "failed";
      run.updatedAt = Date.now();
      run.completedAt = run.updatedAt;
      await this.workflowRunRepository.save(run);

      const turn: ConversationTurn = {
        role: "tool",
        content: JSON.stringify({ error: message, workflowRunId: run.id }),
        timestamp: Date.now(),
        metadata: { phase: "workflow", workflowId: definition.id, runId: run.id },
      };
      await this.appendConversation(task.id, [turn]);

      return this.buildFinalResult(task, this.extractAgentResults(run), {
        error: message,
        workflowRunId: run.id,
        workflowId: definition.id,
        workflowVersion: definition.version,
      });
    }
  }

  async resumeHumanTask(humanTaskId: string, response: unknown): Promise<FinalResult> {
    const humanTask = await this.humanTaskRepository.get(humanTaskId);
    if (!humanTask) {
      throw new Error(`Human task ${humanTaskId} not found`);
    }
    if (humanTask.status !== "pending") {
      throw new Error(`Human task ${humanTaskId} is already resolved`);
    }

    const run = await this.workflowRunRepository.get(humanTask.workflowRunId);
    if (!run) {
      throw new Error(`Workflow run ${humanTask.workflowRunId} not found`);
    }

    const definition = await this.workflowRepository.get(humanTask.workflowId, humanTask.workflowVersion);
    if (!definition) {
      throw new Error(`Workflow ${humanTask.workflowId}@${humanTask.workflowVersion} not found`);
    }

    const task = this.taskFromRun(run);
    const resolution = await this.findStep(definition, humanTask.stepId);
    const step = resolution?.step;
    if (!step || (step.type !== "human-input" && step.type !== "human-approval")) {
      throw new Error(`Workflow step ${humanTask.stepId} is not resumable`);
    }

    humanTask.response = response;
    humanTask.status = step.type === "human-input"
      ? "answered"
      : this.mapApprovalResponse(response);
    humanTask.updatedAt = Date.now();
    humanTask.resolvedAt = humanTask.updatedAt;
    await this.humanTaskRepository.save(humanTask);

    const stepState = run.stepStates[humanTask.stepId];
    if (!stepState) {
      throw new Error(`Workflow step state ${humanTask.stepId} not found`);
    }
    stepState.status = "completed";
    stepState.completedAt = Date.now();
    stepState.output = response;
    run.context[step.outputKey ?? humanTask.stepId] = response;
    run.status = "running";
    run.currentStepId = humanTask.stepId;
    run.updatedAt = Date.now();
    await this.workflowRunRepository.save(run);

    if (step.type === "human-approval") {
      const handled = await this.handleApprovalOutcome({
        definition,
        resolution: {
          ...resolution,
          step,
        },
        task,
        run,
        response,
      });
      if (handled) {
        return handled;
      }
    }

    const pause = await this.executeDefinition(definition, task, run, "");
    if (pause) {
      run.status = "waiting_for_human";
      run.currentStepId = pause.stepId;
      run.updatedAt = Date.now();
      await this.workflowRunRepository.save(run);

      return this.buildFinalResult(task, this.extractAgentResults(run), {
        waitingForHuman: true,
        workflowRunId: run.id,
        humanTaskId: pause.humanTask.id,
        stepId: pause.stepId,
        workflowId: definition.id,
        workflowVersion: definition.version,
      });
    }

    run.status = "completed";
    run.currentStepId = undefined;
    run.updatedAt = Date.now();
    run.completedAt = run.updatedAt;
    await this.workflowRunRepository.save(run);

    return this.buildFinalResult(task, this.extractAgentResults(run), {
      workflowRunId: run.id,
      workflowId: definition.id,
      workflowVersion: definition.version,
      context: run.context,
    }, true);
  }

  private async executeDefinition(
    definition: WorkflowDefinition,
    task: Task,
    run: WorkflowRun,
    prefix: string,
  ): Promise<WorkflowPause | undefined> {
    for (const step of definition.steps) {
      const effectiveStepId = `${prefix}${step.id}`;
      const existingState = run.stepStates[effectiveStepId];
      if (existingState?.status === "completed") {
        continue;
      }
      this.ensureDependenciesSatisfied(step, prefix, run.stepStates);

      const startTurn: ConversationTurn = {
        role: "system",
        content: JSON.stringify({
          action: "workflow-step-started",
          workflowId: definition.id,
          workflowVersion: definition.version,
          stepId: effectiveStepId,
          type: step.type,
        }),
        timestamp: Date.now(),
      };
      await this.appendConversation(task.id, [startTurn]);

      const stepState: WorkflowStepRunState = {
        stepId: effectiveStepId,
        status: existingState?.status ?? "running",
        startedAt: existingState?.startedAt ?? Date.now(),
        completedAt: existingState?.completedAt,
        output: existingState?.output,
        error: existingState?.error,
        conversation: existingState?.conversation,
        taskResult: existingState?.taskResult,
      };
      stepState.status = "running";
      run.stepStates[effectiveStepId] = stepState;
      run.currentStepId = effectiveStepId;
      run.updatedAt = Date.now();
      await this.workflowRunRepository.save(run);

      if (step.type === "agent") {
        const result = await this.executeAgentStep(task, run, step, effectiveStepId);
        stepState.status = result.success ? "completed" : "failed";
        stepState.completedAt = Date.now();
        stepState.output = result.output;
        stepState.error = result.error;
        stepState.conversation = result.conversation;
        stepState.taskResult = result;
        run.context[step.outputKey ?? effectiveStepId] = result.output;
        stepState.artifactIds = await this.persistArtifacts(task, run, step, effectiveStepId, result.output);
        run.updatedAt = Date.now();
        await this.workflowRunRepository.save(run);
        continue;
      }

      if (step.type === "human-input" || step.type === "human-approval") {
        const humanTask = await this.createHumanTask(definition, run, step, effectiveStepId);
        stepState.status = "waiting_for_human";
        run.status = "waiting_for_human";
        run.updatedAt = Date.now();
        await this.workflowRunRepository.save(run);

        const pauseTurn: ConversationTurn = {
          role: "tool",
          content: JSON.stringify({
            action: "workflow-paused",
            workflowId: definition.id,
            workflowVersion: definition.version,
            stepId: effectiveStepId,
            humanTaskId: humanTask.id,
            type: humanTask.type,
          }),
          timestamp: Date.now(),
        };
        await this.appendConversation(task.id, [pauseTurn]);
        return { humanTask, stepId: effectiveStepId };
      }

      if (step.type === "subworkflow") {
        const nested = await this.workflowRepository.get(
          step.workflow.workflowId,
          step.workflow.workflowVersion,
        );
        if (!nested) {
          throw new Error(`Subworkflow ${step.workflow.workflowId} not found`);
        }
        const pause = await this.executeDefinition(
          nested,
          task,
          run,
          `${effectiveStepId}.`,
        );
        if (pause) {
          return pause;
        }
        stepState.status = "completed";
        stepState.completedAt = Date.now();
        stepState.output = run.context;
        run.context[step.outputKey ?? effectiveStepId] = structuredClone(run.context);
        run.updatedAt = Date.now();
        await this.workflowRunRepository.save(run);
      }
    }

    return undefined;
  }

  private async executeAgentStep(
    task: Task,
    run: WorkflowRun,
    step: Extract<WorkflowStep, { type: "agent" }>,
    effectiveStepId: string,
  ): Promise<TaskResult> {
    const agent = this.agents.get(step.agentId);
    if (!agent) {
      throw new Error(`Workflow step ${effectiveStepId} references unknown agent ${step.agentId}`);
    }

    const capabilityTags = step.capabilityTags ?? agent.manifest.tags;
    const estimatedTokens: TokenEstimate = {
      min: agent.manifest.tokenProfile.min,
      expected: agent.manifest.tokenProfile.typical,
      max: agent.manifest.tokenProfile.max,
    };
    const subTask: SubTask = {
      id: `${task.id}-${effectiveStepId}`,
      parentTaskId: task.id,
      description: this.renderInstruction(step.instruction, task, run.context),
      context: {
        ...task.context,
        workflowRunId: run.id,
        workflowStepId: effectiveStepId,
        workflowContext: structuredClone(run.context),
      },
      dependencies: [],
      capabilityTags,
      complexity: {
        score: 3,
        confidence: 1,
        reasoning: `Deterministic workflow step ${effectiveStepId}`,
        estimatedTokens,
      },
      priority: step.priority ?? task.priority,
    };

    const assignedModel = await this.modelSelector.select(subTask, this.budgetTracker.getAllStates());
    return agent.execute({
      ...subTask,
      assignedModel: this.filterModelChoice(assignedModel, step.preferredProviders),
    });
  }

  private filterModelChoice(model: ModelChoice, preferredProviders?: string[]): ModelChoice {
    if (!preferredProviders || preferredProviders.length === 0) {
      return model;
    }
    if (preferredProviders.includes(model.provider)) {
      return model;
    }
    if (model.fallback && preferredProviders.includes(model.fallback.provider)) {
      return model.fallback;
    }
    return model;
  }

  private renderInstruction(
    instruction: string,
    task: Task,
    workflowContext: Record<string, unknown>,
  ): string {
    const replacements: Record<string, string> = {
      "{{task.description}}": task.description,
      "{{task.context}}": JSON.stringify(task.context, null, 2),
      "{{workflow.context}}": JSON.stringify(workflowContext, null, 2),
    };

    let rendered = instruction;
    for (const [token, value] of Object.entries(replacements)) {
      rendered = rendered.replaceAll(token, value);
    }
    return rendered;
  }

  private ensureDependenciesSatisfied(
    step: WorkflowStep,
    prefix: string,
    states: Record<string, WorkflowStepRunState>,
  ): void {
    for (const dependency of step.dependsOn ?? []) {
      const dependencyState = states[`${prefix}${dependency}`];
      if (!dependencyState || dependencyState.status !== "completed") {
        throw new Error(`Workflow step ${step.id} cannot run before dependency ${dependency} completes`);
      }
    }
  }

  private async createHumanTask(
    definition: WorkflowDefinition,
    run: WorkflowRun,
    step: Extract<WorkflowStep, { type: "human-input" | "human-approval" }>,
    effectiveStepId: string,
  ): Promise<HumanTaskRecord> {
    const now = Date.now();
    const humanTask: HumanTaskRecord = {
      id: crypto.randomUUID(),
      workflowRunId: run.id,
      workflowId: definition.id,
      workflowVersion: definition.version,
      stepId: effectiveStepId,
      type: step.type === "human-input" ? "question" : "approval",
      status: "pending",
      title: step.name,
      prompt: this.renderInstruction(step.prompt, {
        id: run.taskId,
        description: String(run.context.taskDescription ?? ""),
        context: (run.context.taskContext as Record<string, unknown> | undefined) ?? {},
        origin: { channel: "api", replyTo: "", messageId: "", rawPayload: {} },
        priority: "normal",
        createdAt: run.createdAt,
      }, run.context),
      assignedTo: step.assignedTo,
      promptMode: step.type === "human-input" ? step.promptMode : undefined,
      questions: step.type === "human-input"
        ? (step.questions && step.questions.length > 0
            ? step.questions
            : this.deriveQuestionnaireFields(run.context))
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.humanTaskRepository.save(humanTask);
    return humanTask;
  }

  private buildFinalResult(
    task: Task,
    results: TaskResult[],
    output: unknown,
    success = false,
  ): FinalResult {
    const totalTokens = results.reduce<TokenUsage>(
      (acc, result) => ({
        input: acc.input + result.actualTokens.input,
        output: acc.output + result.actualTokens.output,
        total: acc.total + result.actualTokens.total,
      }),
      { input: 0, output: 0, total: 0 },
    );
    const totalCost = results.reduce((sum, result) => sum + result.actualCost, 0);
    const totalLatencyMs = results.reduce((sum, result) => sum + result.latencyMs, 0);
    const modelBreakdown: Record<string, TokenUsage> = {};

    for (const result of results) {
      const key = `${result.modelUsed.provider}:${result.modelUsed.modelId}`;
      const existing = modelBreakdown[key];
      if (existing) {
        existing.input += result.actualTokens.input;
        existing.output += result.actualTokens.output;
        existing.total += result.actualTokens.total;
      } else {
        modelBreakdown[key] = { ...result.actualTokens };
      }
    }

    return {
      taskId: task.id,
      output,
      success,
      subResults: results,
      totalTokens,
      totalCost,
      totalLatencyMs,
      modelBreakdown,
      conversation: results.flatMap((result) => result.conversation ?? []),
    };
  }

  private extractAgentResults(run: WorkflowRun): TaskResult[] {
    return Object.values(run.stepStates)
      .flatMap((stepState) => (stepState.taskResult ? [stepState.taskResult] : []))
      .sort((a, b) => a.subTaskId.localeCompare(b.subTaskId));
  }

  private taskFromRun(run: WorkflowRun): Task {
    return {
      id: run.taskId,
      description: String(run.context.taskDescription ?? ""),
      context: (run.context.taskContext as Record<string, unknown> | undefined) ?? {},
      origin: { channel: "api", replyTo: "", messageId: "", rawPayload: {} },
      priority: "normal",
      createdAt: run.createdAt,
      workflow: {
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
      },
    };
  }

  private async findStep(
    definition: WorkflowDefinition,
    stepId: string,
    prefix = "",
  ): Promise<WorkflowStepResolution | undefined> {
    for (const step of definition.steps) {
      const effectiveStepId = `${prefix}${step.id}`;
      if (effectiveStepId === stepId) {
        return {
          definition,
          step,
          prefix,
          effectiveStepId,
        };
      }
      if (step.type !== "subworkflow") {
        continue;
      }
      const nestedDefinition = await this.workflowRepository.get(
        step.workflow.workflowId,
        step.workflow.workflowVersion,
      );
      if (!nestedDefinition) {
        continue;
      }
      const nested = await this.findStep(nestedDefinition, stepId, `${effectiveStepId}.`);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  private mapApprovalResponse(response: unknown): HumanTaskRecord["status"] {
    const decision = this.extractApprovalDecision(response);
    if (decision) {
      return decision;
    }
    return "approved";
  }

  private extractApprovalDecision(response: unknown): HumanApprovalDecision | undefined {
    if (response === "approved" || response === "rejected" || response === "changes_requested") {
      return response;
    }
    if (
      response !== null
      && typeof response === "object"
      && "decision" in response
      && (
        response.decision === "approved"
        || response.decision === "rejected"
        || response.decision === "changes_requested"
      )
    ) {
      return response.decision;
    }
    return undefined;
  }

  private async handleApprovalOutcome(args: {
    definition: WorkflowDefinition;
    resolution: WorkflowStepResolution & {
      step: Extract<WorkflowStep, { type: "human-approval" }>;
    };
    task: Task;
    run: WorkflowRun;
    response: unknown;
  }): Promise<FinalResult | undefined> {
    const decision = this.extractApprovalDecision(args.response) ?? "approved";
    if (decision === "approved") {
      return undefined;
    }

    const routeStepId = decision === "changes_requested"
      ? args.resolution.step.onChangesRequested
      : args.resolution.step.onRejected;

    if (decision === "rejected" && (!routeStepId || routeStepId === "fail")) {
      return await this.failRunFromHumanApproval(
        args.task,
        args.run,
        args.definition,
        args.resolution.effectiveStepId,
        "Human approval rejected the workflow output.",
      );
    }

    if (!routeStepId) {
      return await this.failRunFromHumanApproval(
        args.task,
        args.run,
        args.definition,
        args.resolution.effectiveStepId,
        `Human approval returned "${decision}" but no reroute is configured for step ${args.resolution.step.id}.`,
      );
    }

    this.resetWorkflowBranch(
      args.run,
      args.resolution.definition,
      args.resolution.prefix,
      routeStepId,
    );
    args.run.context[args.resolution.step.outputKey ?? args.resolution.effectiveStepId] = args.response;
    args.run.currentStepId = `${args.resolution.prefix}${routeStepId}`;
    args.run.updatedAt = Date.now();
    await this.workflowRunRepository.save(args.run);
    return undefined;
  }

  private async failRunFromHumanApproval(
    task: Task,
    run: WorkflowRun,
    definition: WorkflowDefinition,
    stepId: string,
    error: string,
  ): Promise<FinalResult> {
    const now = Date.now();
    run.status = "failed";
    run.currentStepId = stepId;
    run.updatedAt = now;
    run.completedAt = now;
    await this.workflowRunRepository.save(run);

    return this.buildFinalResult(task, this.extractAgentResults(run), {
      error,
      workflowRunId: run.id,
      workflowId: definition.id,
      workflowVersion: definition.version,
      context: run.context,
    });
  }

  private resetWorkflowBranch(
    run: WorkflowRun,
    definition: WorkflowDefinition,
    prefix: string,
    targetStepId: string,
  ): void {
    const stepMap = new Map(definition.steps.map((step) => [step.id, step]));
    const reverseDeps = new Map<string, string[]>();

    for (const step of definition.steps) {
      for (const dependency of step.dependsOn ?? []) {
        const current = reverseDeps.get(dependency) ?? [];
        reverseDeps.set(dependency, [...current, step.id]);
      }
    }

    const queue = [targetStepId];
    const toReset = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || toReset.has(current)) {
        continue;
      }
      toReset.add(current);
      for (const dependentId of reverseDeps.get(current) ?? []) {
        queue.push(dependentId);
      }
    }

    for (const localStepId of toReset) {
      const step = stepMap.get(localStepId);
      if (!step) {
        continue;
      }
      const effectiveStepId = `${prefix}${step.id}`;
      delete run.stepStates[effectiveStepId];
      delete run.context[step.outputKey ?? effectiveStepId];

      if (step.type === "subworkflow") {
        const nestedPrefix = `${effectiveStepId}.`;
        for (const stateId of Object.keys(run.stepStates)) {
          if (stateId.startsWith(nestedPrefix)) {
            delete run.stepStates[stateId];
          }
        }
      }
    }
  }

  private async appendConversation(taskId: string, conversation: ConversationTurn[]): Promise<void> {
    if (!this.onConversationAppended || conversation.length === 0) {
      return;
    }
    await this.onConversationAppended(taskId, conversation);
  }

  private deriveQuestionnaireFields(context: Record<string, unknown>): HumanTaskRecord["questions"] {
    const candidates = this.collectQuestionCandidates(context);
    if (candidates.length === 0) {
      return undefined;
    }

    return candidates.map((candidate, index) => ({
      id: candidate.id ?? `question-${index + 1}`,
      label: candidate.label,
      helpText: candidate.helpText,
      placeholder: "Answer this question",
    }));
  }

  private collectQuestionCandidates(
    value: unknown,
    path: string[] = [],
  ): Array<{ id?: string; label: string; helpText?: string }> {
    if (Array.isArray(value)) {
      const key = path[path.length - 1]?.toLowerCase() ?? "";
      if (key === "openquestions" || key === "questions") {
        return value.flatMap((item, index) => {
          if (typeof item === "string" && item.trim().length > 0) {
            return [{ id: `question-${index + 1}`, label: item.trim() }];
          }

          if (item !== null && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const label = typeof record.question === "string"
              ? record.question
              : typeof record.label === "string"
                ? record.label
                : undefined;
            if (!label) {
              return [];
            }

            return [{
              id: typeof record.id === "string" ? record.id : `question-${index + 1}`,
              label,
              helpText: typeof record.rationale === "string"
                ? record.rationale
                : typeof record.helpText === "string"
                  ? record.helpText
                  : undefined,
            }];
          }

          return [];
        });
      }

      return value.flatMap((item, index) => this.collectQuestionCandidates(item, [...path, `item-${index + 1}`]));
    }

    if (value !== null && typeof value === "object") {
      return Object.entries(value).flatMap(([key, item]) => this.collectQuestionCandidates(item, [...path, key]));
    }

    return [];
  }

  private async persistArtifacts(
    task: Task,
    run: WorkflowRun,
    step: Extract<WorkflowStep, { type: "agent" }>,
    effectiveStepId: string,
    output: unknown,
  ): Promise<string[] | undefined> {
    if (!this.artifactRepository) {
      return undefined;
    }

    const drafts = this.extractArtifactDrafts(step.name, output);
    if (drafts.length === 0) {
      return undefined;
    }

    const artifactIds: string[] = [];
    const now = Date.now();

    for (const [index, draft] of drafts.entries()) {
      const artifactId = crypto.randomUUID();
      const extension = draft.kind === "markdown" ? "md" : draft.kind === "json" ? "json" : "txt";
      const safeName = `${this.slugify(draft.title)}-${index + 1}.${extension}`;
      const taskDir = join(this.artifactRootDir, task.id);
      const storagePath = join(taskDir, safeName);

      await mkdir(taskDir, { recursive: true });
      await writeFile(storagePath, draft.content, "utf8");

      const artifact: WorkflowArtifactRecord = {
        id: artifactId,
        taskId: task.id,
        workflowRunId: run.id,
        stepId: effectiveStepId,
        title: draft.title,
        kind: draft.kind,
        mimeType: draft.kind === "markdown"
          ? "text/markdown; charset=utf-8"
          : draft.kind === "json"
            ? "application/json; charset=utf-8"
            : "text/plain; charset=utf-8",
        fileName: safeName,
        storagePath,
        sizeBytes: Buffer.byteLength(draft.content, "utf8"),
        createdAt: now,
        updatedAt: now,
        metadata: draft.metadata,
      };

      await this.artifactRepository.save(artifact);
      artifactIds.push(artifactId);
    }

    run.artifactIds = [...(run.artifactIds ?? []), ...artifactIds];
    return artifactIds;
  }

  private extractArtifactDrafts(
    stepName: string,
    value: unknown,
    path: string[] = [],
  ): Array<{ title: string; kind: WorkflowArtifactKind; content: string; metadata?: Record<string, unknown> }> {
    if (typeof value === "string") {
      if (!this.shouldPersistTextArtifact(value)) {
        return [];
      }

      return [{
        title: path.length > 0 ? `${stepName} - ${this.formatArtifactLabel(path[path.length - 1]!)}` : stepName,
        kind: this.inferArtifactKind(value),
        content: value,
        metadata: path.length > 0 ? { sourcePath: path.join(".") } : undefined,
      }];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.extractArtifactDrafts(stepName, item, [...path, `item-${index + 1}`]));
    }

    if (value !== null && typeof value === "object") {
      if (
        "content" in value
        && typeof value.content === "string"
        && this.shouldPersistTextArtifact(value.content)
      ) {
        const format = "format" in value && typeof value.format === "string" ? value.format : undefined;
        const title = "title" in value && typeof value.title === "string"
          ? value.title
          : path.length > 0
            ? `${stepName} - ${this.formatArtifactLabel(path[path.length - 1]!)}`
            : stepName;

        return [{
          title,
          kind: format === "json" ? "json" : format === "text" ? "text" : this.inferArtifactKind(value.content),
          content: value.content,
          metadata: path.length > 0 ? { sourcePath: path.join(".") } : undefined,
        }];
      }

      return Object.entries(value).flatMap(([key, item]) =>
        this.extractArtifactDrafts(stepName, item, [...path, key]));
    }

    return [];
  }

  private shouldPersistTextArtifact(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.length < 220) {
      return false;
    }

    return trimmed.includes("\n")
      || trimmed.startsWith("#")
      || trimmed.startsWith("{")
      || trimmed.startsWith("[");
  }

  private inferArtifactKind(value: string): WorkflowArtifactKind {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // fall through
      }
    }

    if (
      trimmed.startsWith("#")
      || trimmed.includes("\n## ")
      || trimmed.includes("\n- ")
      || trimmed.includes("|")
      || trimmed.includes("**")
    ) {
      return "markdown";
    }

    return "text";
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      || "artifact";
  }

  private formatArtifactLabel(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
