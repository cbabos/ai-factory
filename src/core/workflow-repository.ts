import type {
  HumanTaskRecord,
  WorkflowArtifactRecord,
  WorkflowDefinition,
  WorkflowRun,
} from "./workflow-types.js";

export interface IWorkflowRepository {
  save(definition: WorkflowDefinition): Promise<void>;
  get(workflowId: string, version?: number): Promise<WorkflowDefinition | undefined>;
  getAll(): Promise<WorkflowDefinition[]>;
}

export interface IWorkflowRunRepository {
  save(run: WorkflowRun): Promise<void>;
  get(runId: string): Promise<WorkflowRun | undefined>;
  getByTaskId(taskId: string): Promise<WorkflowRun | undefined>;
  getAll(): Promise<WorkflowRun[]>;
}

export interface IHumanTaskRepository {
  save(task: HumanTaskRecord): Promise<void>;
  get(taskId: string): Promise<HumanTaskRecord | undefined>;
  getByWorkflowRun(workflowRunId: string): Promise<HumanTaskRecord[]>;
  listPending(): Promise<HumanTaskRecord[]>;
}

export interface IWorkflowArtifactRepository {
  save(artifact: WorkflowArtifactRecord): Promise<void>;
  get(artifactId: string): Promise<WorkflowArtifactRecord | undefined>;
  getByTaskId(taskId: string): Promise<WorkflowArtifactRecord[]>;
  getByWorkflowRun(workflowRunId: string): Promise<WorkflowArtifactRecord[]>;
}

export class InMemoryWorkflowRepository implements IWorkflowRepository {
  private readonly definitions = new Map<string, WorkflowDefinition>();

  async save(definition: WorkflowDefinition): Promise<void> {
    this.definitions.set(`${definition.id}@${definition.version}`, structuredClone(definition));
  }

  async get(workflowId: string, version?: number): Promise<WorkflowDefinition | undefined> {
    if (version !== undefined) {
      return this.definitions.get(`${workflowId}@${version}`);
    }

    const versions = [...this.definitions.values()]
      .filter((definition) => definition.id === workflowId)
      .sort((a, b) => b.version - a.version);
    return versions.find((definition) => definition.status === "active") ?? versions[0];
  }

  async getAll(): Promise<WorkflowDefinition[]> {
    return [...this.definitions.values()].sort((a, b) => {
      if (a.id === b.id) {
        return b.version - a.version;
      }
      return a.id.localeCompare(b.id);
    });
  }
}

export class InMemoryWorkflowRunRepository implements IWorkflowRunRepository {
  private readonly runs = new Map<string, WorkflowRun>();

  async save(run: WorkflowRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  async get(runId: string): Promise<WorkflowRun | undefined> {
    return this.runs.get(runId);
  }

  async getByTaskId(taskId: string): Promise<WorkflowRun | undefined> {
    return [...this.runs.values()]
      .filter((run) => run.taskId === taskId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  async getAll(): Promise<WorkflowRun[]> {
    return [...this.runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export class InMemoryHumanTaskRepository implements IHumanTaskRepository {
  private readonly tasks = new Map<string, HumanTaskRecord>();

  async save(task: HumanTaskRecord): Promise<void> {
    this.tasks.set(task.id, structuredClone(task));
  }

  async get(taskId: string): Promise<HumanTaskRecord | undefined> {
    return this.tasks.get(taskId);
  }

  async getByWorkflowRun(workflowRunId: string): Promise<HumanTaskRecord[]> {
    return [...this.tasks.values()]
      .filter((task) => task.workflowRunId === workflowRunId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async listPending(): Promise<HumanTaskRecord[]> {
    return [...this.tasks.values()]
      .filter((task) => task.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);
  }
}

export class InMemoryWorkflowArtifactRepository implements IWorkflowArtifactRepository {
  private readonly artifacts = new Map<string, WorkflowArtifactRecord>();

  async save(artifact: WorkflowArtifactRecord): Promise<void> {
    this.artifacts.set(artifact.id, structuredClone(artifact));
  }

  async get(artifactId: string): Promise<WorkflowArtifactRecord | undefined> {
    return this.artifacts.get(artifactId);
  }

  async getByTaskId(taskId: string): Promise<WorkflowArtifactRecord[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.taskId === taskId)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  async getByWorkflowRun(workflowRunId: string): Promise<WorkflowArtifactRecord[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.workflowRunId === workflowRunId)
      .sort((left, right) => left.createdAt - right.createdAt);
  }
}
