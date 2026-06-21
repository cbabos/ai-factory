import type {
  Task,
  SubTask,
  TaskResult,
  FinalResult,
  ComplexityScore,
} from "./types.js";
import type {
  IOrchestrator,
  IComplexityEstimator,
  ITaskDecomposer,
  IModelSelector,
  IDispatcher,
  IAggregator,
  IEventBus,
  ITracer,
  IBudgetTracker,
} from "./interfaces.js";
import { PipelineStep, type PipelineContext } from "./pipeline-step.js";

export class Orchestrator
  extends PipelineStep<Task, FinalResult>
  implements IOrchestrator
{
  readonly name = "Orchestrator";

  private estimator: IComplexityEstimator;
  private decomposer: ITaskDecomposer;
  private modelSelector: IModelSelector;
  private dispatcher: IDispatcher;
  private aggregator: IAggregator;
  private budgetTracker: IBudgetTracker;
  private decompositionThreshold: number;

  constructor(deps: {
    estimator: IComplexityEstimator;
    decomposer: ITaskDecomposer;
    modelSelector: IModelSelector;
    dispatcher: IDispatcher;
    aggregator: IAggregator;
    budgetTracker: IBudgetTracker;
    eventBus: IEventBus;
    tracer: ITracer;
    decompositionThreshold: number;
  }) {
    super();
    this.estimator = deps.estimator;
    this.decomposer = deps.decomposer;
    this.modelSelector = deps.modelSelector;
    this.dispatcher = deps.dispatcher;
    this.aggregator = deps.aggregator;
    this.budgetTracker = deps.budgetTracker;
    this.decompositionThreshold = deps.decompositionThreshold;

    const trace = deps.tracer.startTrace("orchestrator-init");
    const ctx: PipelineContext = {
      eventBus: deps.eventBus,
      tracer: deps.tracer,
      traceId: trace.traceId,
    };
    this.setContext(ctx);
  }

  async execute(task: Task): Promise<FinalResult> {
    const trace = this.ctx!.tracer.startTrace(task.id);

    this.emit("task:created", { taskId: task.id, priority: task.priority });

    const span = this.startSpan("orchestrate");

    try {
      const score = await this.estimateComplexity(task);
      const subTasks = await this.decomposeIfNeeded(task, score);
      const assignedSubTasks = await this.assignModels(subTasks);
      const results = await this.dispatch(assignedSubTasks);
      const final = this.aggregate(task, results);

      this.emit("task:completed", {
        taskId: task.id,
        totalTokens: final.totalTokens.total,
        totalCost: final.totalCost,
        totalLatencyMs: final.totalLatencyMs,
      });

      this.endSpan(span!, { success: true, subTaskCount: subTasks.length });
      this.ctx!.tracer.endTrace(trace);
      return final;
    } catch (err) {
      this.emit("task:failed", {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });

      this.endSpan(span!, { success: false, error: String(err) });
      this.ctx!.tracer.endTrace(trace);

      return {
        taskId: task.id,
        output: null,
        success: false,
        subResults: [],
        totalTokens: { input: 0, output: 0, total: 0 },
        totalCost: 0,
        totalLatencyMs: 0,
        modelBreakdown: {},
      };
    }
  }

  private async estimateComplexity(task: Task): Promise<ComplexityScore> {
    const span = this.startSpan("estimate-complexity");
    const score = await this.estimator.execute(task);
    this.endSpan(span!, { score: score.score, confidence: score.confidence });
    return score;
  }

  private async decomposeIfNeeded(
    task: Task,
    score: ComplexityScore,
  ): Promise<SubTask[]> {
    if (score.score <= this.decompositionThreshold) {
      return [
        {
          id: `${task.id}-direct`,
          parentTaskId: task.id,
          description: task.description,
          context: task.context,
          dependencies: [],
          capabilityTags: task.constraints?.requiredCapabilities ?? [],
          complexity: score,
          priority: task.priority,
        },
      ];
    }

    const span = this.startSpan("decompose");
    const subTasks = await this.decomposer.decompose(task, score);
    this.emit("task:decomposed", {
      taskId: task.id,
      subTaskCount: subTasks.length,
    });
    this.endSpan(span!, { subTaskCount: subTasks.length });
    return subTasks;
  }

  private async assignModels(subTasks: SubTask[]): Promise<SubTask[]> {
    const budget = this.budgetTracker.getAllStates();
    const assigned: SubTask[] = [];

    for (const st of subTasks) {
      const span = this.startSpan("select-model");
      const choice = await this.modelSelector.select(st, budget);
      this.emit("model:selected", {
        subTaskId: st.id,
        provider: choice.provider,
        model: choice.modelId,
        estimatedCost: choice.estimatedCost,
      });
      this.endSpan(span!, {
        provider: choice.provider,
        model: choice.modelId,
      });

      assigned.push({ ...st, assignedModel: choice });
    }

    return assigned;
  }

  private async dispatch(subTasks: SubTask[]): Promise<TaskResult[]> {
    const span = this.startSpan("dispatch-all");
    const results = await this.dispatcher.execute(subTasks);
    this.endSpan(span!, { resultCount: results.length });
    return results;
  }

  private aggregate(task: Task, results: TaskResult[]): FinalResult {
    const span = this.startSpan("aggregate");
    const final = this.aggregator.aggregate(task, results);
    this.endSpan(span!);
    return final;
  }
}
