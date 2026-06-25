import { DatabaseSync, type StatementSync } from "node:sqlite";
import type {
  HumanTaskRecord,
  WorkflowArtifactRecord,
  WorkflowDefinition,
  WorkflowRun,
} from "./workflow-types.js";
import type {
  IWorkflowArtifactRepository,
  IHumanTaskRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
} from "./workflow-repository.js";

export class SQLiteWorkflowRepository implements IWorkflowRepository {
  private readonly db: DatabaseSync;
  private readonly saveStmt: StatementSync;
  private readonly getVersionStmt: StatementSync;
  private readonly getLatestStmt: StatementSync;
  private readonly getAllStmt: StatementSync;

  constructor(path: string, tableName: string = "workflows") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        workflow_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workflow_id, version)
      )`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_lookup
       ON ${tableName}(workflow_id, status, version DESC)`,
    );

    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName} (workflow_id, version, status, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(workflow_id, version) DO UPDATE SET
         status = excluded.status,
         data = excluded.data,
         updated_at = excluded.updated_at`,
    );
    this.getVersionStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE workflow_id = ? AND version = ?`,
    );
    this.getLatestStmt = this.db.prepare(
      `SELECT data
       FROM ${tableName}
       WHERE workflow_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, version DESC
       LIMIT 1`,
    );
    this.getAllStmt = this.db.prepare(
      `SELECT data FROM ${tableName} ORDER BY workflow_id ASC, version DESC`,
    );
  }

  async save(definition: WorkflowDefinition): Promise<void> {
    this.saveStmt.run(
      definition.id,
      definition.version,
      definition.status,
      JSON.stringify(definition),
      definition.createdAt,
      definition.updatedAt,
    );
  }

  async get(workflowId: string, version?: number): Promise<WorkflowDefinition | undefined> {
    const row = version !== undefined
      ? (this.getVersionStmt.get(workflowId, version) as { data: string } | undefined)
      : (this.getLatestStmt.get(workflowId) as { data: string } | undefined);
    return row ? (JSON.parse(row.data) as WorkflowDefinition) : undefined;
  }

  async getAll(): Promise<WorkflowDefinition[]> {
    const rows = this.getAllStmt.all() as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as WorkflowDefinition);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SQLiteWorkflowRunRepository implements IWorkflowRunRepository {
  private readonly db: DatabaseSync;
  private readonly saveStmt: StatementSync;
  private readonly getStmt: StatementSync;
  private readonly getByTaskIdStmt: StatementSync;
  private readonly getAllStmt: StatementSync;

  constructor(path: string, tableName: string = "workflow_runs") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        workflow_version INTEGER NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step_id TEXT,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      )`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_task
       ON ${tableName}(task_id, updated_at DESC)`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_status
       ON ${tableName}(status, updated_at DESC)`,
    );

    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName}
        (id, workflow_id, workflow_version, task_id, status, current_step_id, data, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         current_step_id = excluded.current_step_id,
         data = excluded.data,
         updated_at = excluded.updated_at,
         completed_at = excluded.completed_at`,
    );
    this.getStmt = this.db.prepare(`SELECT data FROM ${tableName} WHERE id = ?`);
    this.getByTaskIdStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE task_id = ? ORDER BY updated_at DESC LIMIT 1`,
    );
    this.getAllStmt = this.db.prepare(`SELECT data FROM ${tableName} ORDER BY updated_at DESC`);
  }

  async save(run: WorkflowRun): Promise<void> {
    this.saveStmt.run(
      run.id,
      run.workflowId,
      run.workflowVersion,
      run.taskId,
      run.status,
      run.currentStepId ?? null,
      JSON.stringify(run),
      run.createdAt,
      run.updatedAt,
      run.completedAt ?? null,
    );
  }

  async get(runId: string): Promise<WorkflowRun | undefined> {
    const row = this.getStmt.get(runId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as WorkflowRun) : undefined;
  }

  async getByTaskId(taskId: string): Promise<WorkflowRun | undefined> {
    const row = this.getByTaskIdStmt.get(taskId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as WorkflowRun) : undefined;
  }

  async getAll(): Promise<WorkflowRun[]> {
    const rows = this.getAllStmt.all() as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as WorkflowRun);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SQLiteHumanTaskRepository implements IHumanTaskRepository {
  private readonly db: DatabaseSync;
  private readonly saveStmt: StatementSync;
  private readonly getStmt: StatementSync;
  private readonly getByWorkflowRunStmt: StatementSync;
  private readonly listPendingStmt: StatementSync;

  constructor(path: string, tableName: string = "human_tasks") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        workflow_version INTEGER NOT NULL,
        step_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        assigned_to TEXT,
        response TEXT,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        resolved_at INTEGER
      )`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_pending
       ON ${tableName}(status, created_at ASC)`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_run
       ON ${tableName}(workflow_run_id, created_at ASC)`,
    );

    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName}
        (id, workflow_run_id, workflow_id, workflow_version, step_id, type, status, title, prompt, assigned_to, response, data, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         assigned_to = excluded.assigned_to,
         response = excluded.response,
         data = excluded.data,
         updated_at = excluded.updated_at,
         resolved_at = excluded.resolved_at`,
    );
    this.getStmt = this.db.prepare(`SELECT data FROM ${tableName} WHERE id = ?`);
    this.getByWorkflowRunStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE workflow_run_id = ? ORDER BY created_at ASC`,
    );
    this.listPendingStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE status = 'pending' ORDER BY created_at ASC`,
    );
  }

  async save(task: HumanTaskRecord): Promise<void> {
    this.saveStmt.run(
      task.id,
      task.workflowRunId,
      task.workflowId,
      task.workflowVersion,
      task.stepId,
      task.type,
      task.status,
      task.title,
      task.prompt,
      task.assignedTo ?? null,
      task.response !== undefined ? JSON.stringify(task.response) : null,
      JSON.stringify(task),
      task.createdAt,
      task.updatedAt,
      task.resolvedAt ?? null,
    );
  }

  async get(taskId: string): Promise<HumanTaskRecord | undefined> {
    const row = this.getStmt.get(taskId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as HumanTaskRecord) : undefined;
  }

  async getByWorkflowRun(workflowRunId: string): Promise<HumanTaskRecord[]> {
    const rows = this.getByWorkflowRunStmt.all(workflowRunId) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as HumanTaskRecord);
  }

  async listPending(): Promise<HumanTaskRecord[]> {
    const rows = this.listPendingStmt.all() as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as HumanTaskRecord);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SQLiteWorkflowArtifactRepository implements IWorkflowArtifactRepository {
  private readonly db: DatabaseSync;
  private readonly saveStmt: StatementSync;
  private readonly getStmt: StatementSync;
  private readonly getByTaskStmt: StatementSync;
  private readonly getByWorkflowRunStmt: StatementSync;

  constructor(path: string, tableName: string = "workflow_artifacts") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        workflow_run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_task
       ON ${tableName}(task_id, created_at ASC)`,
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_run
       ON ${tableName}(workflow_run_id, created_at ASC)`,
    );

    this.saveStmt = this.db.prepare(
      `INSERT INTO ${tableName}
        (id, task_id, workflow_run_id, step_id, title, kind, mime_type, file_name, storage_path, size_bytes, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         kind = excluded.kind,
         mime_type = excluded.mime_type,
         file_name = excluded.file_name,
         storage_path = excluded.storage_path,
         size_bytes = excluded.size_bytes,
         data = excluded.data,
         updated_at = excluded.updated_at`,
    );
    this.getStmt = this.db.prepare(`SELECT data FROM ${tableName} WHERE id = ?`);
    this.getByTaskStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE task_id = ? ORDER BY created_at ASC`,
    );
    this.getByWorkflowRunStmt = this.db.prepare(
      `SELECT data FROM ${tableName} WHERE workflow_run_id = ? ORDER BY created_at ASC`,
    );
  }

  async save(artifact: WorkflowArtifactRecord): Promise<void> {
    this.saveStmt.run(
      artifact.id,
      artifact.taskId,
      artifact.workflowRunId,
      artifact.stepId,
      artifact.title,
      artifact.kind,
      artifact.mimeType,
      artifact.fileName,
      artifact.storagePath,
      artifact.sizeBytes,
      JSON.stringify(artifact),
      artifact.createdAt,
      artifact.updatedAt,
    );
  }

  async get(artifactId: string): Promise<WorkflowArtifactRecord | undefined> {
    const row = this.getStmt.get(artifactId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as WorkflowArtifactRecord) : undefined;
  }

  async getByTaskId(taskId: string): Promise<WorkflowArtifactRecord[]> {
    const rows = this.getByTaskStmt.all(taskId) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as WorkflowArtifactRecord);
  }

  async getByWorkflowRun(workflowRunId: string): Promise<WorkflowArtifactRecord[]> {
    const rows = this.getByWorkflowRunStmt.all(workflowRunId) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as WorkflowArtifactRecord);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
