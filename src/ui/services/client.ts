import type { Priority } from '../../core/types.js';
import { API_ENDPOINTS, API_BASE_URL } from './api.js';
import type {
  AgentMutationInput,
  AgentRecord,
  AppSettings,
  TagMutationInput,
  TagRecord,
  ModelMutationInput,
  ModelRecord,
  PaginatedTasks,
  TaskDetails,
  TaskCreateInput,
  TaskListItem,
  TaskQuery,
  TaskRecord,
  ThemeSettings,
  UiTaskStatus,
  WorkflowDefinitionRecord,
  WorkflowMutationInput,
  WorkflowRunRecord,
  HumanTaskRecord,
} from './types.js';

interface ApiEnvelope<T> {
  data: T;
}

interface ApiListEnvelope<T> {
  data: T[];
  total: number;
}

interface TaskListEnvelope {
  items: TaskRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface HumanTaskListEnvelope {
  data: HumanTaskRecord[];
  total: number;
}

interface WorkflowRunListEnvelope {
  data: WorkflowRunRecord[];
  total: number;
}

function extractWorkflowRunId(output: unknown): string | undefined {
  if (typeof output !== 'object' || output === null) {
    return undefined;
  }

  if ('workflowRunId' in output && typeof output.workflowRunId === 'string') {
    return output.workflowRunId;
  }

  if (
    'output' in output
    && typeof output.output === 'object'
    && output.output !== null
    && 'workflowRunId' in output.output
    && typeof output.output.workflowRunId === 'string'
  ) {
    return output.output.workflowRunId;
  }

  return undefined;
}

const defaultHeaders = {
  'Content-Type': 'application/json',
} as const;

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function mapTaskRecordToListItem(record: TaskRecord): TaskListItem {
  return {
    id: record.id,
    description: record.task.description,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    priority: record.task.priority,
    originChannel: record.task.origin?.channel,
    cost: record.result?.totalCost,
    tokens: record.result?.totalTokens.total,
    workflowId: record.task.workflow?.workflowId,
    workflowVersion: record.task.workflow?.workflowVersion,
    workflowRunId: record.workflowRunId ?? extractWorkflowRunId(record.result?.output),
    workflowRunStatus: record.workflowRunStatus,
  };
}

function mapTaskRecordToDetails(record: TaskRecord): TaskDetails {
  return {
    ...mapTaskRecordToListItem(record),
    output: record.result?.output,
    conversation: record.conversation ?? record.result?.conversation ?? [],
    artifacts: record.artifacts ?? [],
  };
}

function buildTaskQuery(query: TaskQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  const search = params.toString();
  return search ? `?${search}` : '';
}

export const apiClient = {
  baseUrl: API_BASE_URL,

  async listAgents(): Promise<AgentRecord[]> {
    const response = await requestJson<ApiListEnvelope<AgentRecord>>(API_ENDPOINTS.agents);
    return response.data;
  },

  async createAgent(agent: AgentMutationInput): Promise<AgentRecord> {
    const response = await requestJson<ApiEnvelope<AgentRecord>>(API_ENDPOINTS.agents, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(agent),
    });
    return response.data;
  },

  async updateAgent(id: string, agent: AgentMutationInput): Promise<AgentRecord> {
    const response = await requestJson<ApiEnvelope<AgentRecord>>(`${API_ENDPOINTS.agents}/${id}`, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(agent),
    });
    return response.data;
  },

  async deleteAgent(id: string): Promise<void> {
    await requestJson<void>(`${API_ENDPOINTS.agents}/${id}`, {
      method: 'DELETE',
    });
  },

  async listModels(): Promise<ModelRecord[]> {
    const response = await requestJson<ApiListEnvelope<ModelRecord>>(API_ENDPOINTS.models);
    return response.data;
  },

  async listAvailableModels(provider?: string): Promise<ModelRecord[]> {
    const params = new URLSearchParams({ includeDiscovered: 'true' });
    if (provider) {
      params.set('provider', provider);
    }
    const response = await requestJson<ApiListEnvelope<ModelRecord>>(`${API_ENDPOINTS.models}?${params.toString()}`);
    return response.data;
  },

  async listTags(includeInactive = true): Promise<TagRecord[]> {
    const suffix = includeInactive ? '' : '?isActive=true';
    const response = await requestJson<ApiListEnvelope<TagRecord>>(`${API_ENDPOINTS.tags}${suffix}`);
    return response.data;
  },

  async createTag(tag: TagMutationInput): Promise<TagRecord> {
    const response = await requestJson<ApiEnvelope<TagRecord>>(API_ENDPOINTS.tags, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(tag),
    });
    return response.data;
  },

  async updateTag(id: string, tag: Partial<TagMutationInput>): Promise<TagRecord> {
    const response = await requestJson<ApiEnvelope<TagRecord>>(`${API_ENDPOINTS.tags}/${id}`, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(tag),
    });
    return response.data;
  },

  async deleteTag(id: string): Promise<void> {
    await requestJson<void>(`${API_ENDPOINTS.tags}/${id}`, {
      method: 'DELETE',
    });
  },

  async createModel(model: ModelMutationInput): Promise<ModelRecord> {
    const response = await requestJson<ApiEnvelope<ModelRecord>>(API_ENDPOINTS.models, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(model),
    });
    return response.data;
  },

  async updateModel(provider: string, modelId: string, model: Partial<ModelMutationInput>): Promise<ModelRecord> {
    const response = await requestJson<ApiEnvelope<ModelRecord>>(`${API_ENDPOINTS.models}/${provider}/${modelId}`, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(model),
    });
    return response.data;
  },

  async deleteModel(provider: string, modelId: string): Promise<void> {
    await requestJson<void>(`${API_ENDPOINTS.models}/${provider}/${modelId}`, {
      method: 'DELETE',
    });
  },

  async listTasks(query: TaskQuery = {}): Promise<PaginatedTasks> {
    const response = await requestJson<TaskListEnvelope>(`${API_ENDPOINTS.tasks}${buildTaskQuery(query)}`);
    return {
      items: response.items.map(mapTaskRecordToListItem),
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
    };
  },

  async getTask(id: string): Promise<TaskDetails> {
    const response = await requestJson<ApiEnvelope<TaskRecord>>(`${API_ENDPOINTS.tasks}/${id}`);
    return mapTaskRecordToDetails(response.data);
  },

  async createTask(task: TaskCreateInput): Promise<TaskDetails> {
    const response = await requestJson<ApiEnvelope<TaskRecord>>(API_ENDPOINTS.tasks, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(task),
    });
    return mapTaskRecordToDetails(response.data);
  },

  async resubmitTask(id: string): Promise<TaskDetails> {
    const response = await requestJson<ApiEnvelope<TaskRecord>>(`${API_ENDPOINTS.tasks}/${id}/resubmit`, {
      method: 'POST',
      headers: defaultHeaders,
    });
    return mapTaskRecordToDetails(response.data);
  },

  async listWorkflows(): Promise<WorkflowDefinitionRecord[]> {
    const response = await requestJson<ApiListEnvelope<WorkflowDefinitionRecord>>(API_ENDPOINTS.workflows);
    return response.data;
  },

  async getWorkflow(id: string, version?: number): Promise<WorkflowDefinitionRecord> {
    const suffix = version !== undefined ? `?version=${version}` : '';
    const response = await requestJson<ApiEnvelope<WorkflowDefinitionRecord>>(`${API_ENDPOINTS.workflows}/${id}${suffix}`);
    return response.data;
  },

  async createWorkflow(workflow: WorkflowMutationInput): Promise<WorkflowDefinitionRecord> {
    const response = await requestJson<ApiEnvelope<WorkflowDefinitionRecord>>(API_ENDPOINTS.workflows, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(workflow),
    });
    return response.data;
  },

  async updateWorkflow(id: string, workflow: Partial<WorkflowMutationInput>): Promise<WorkflowDefinitionRecord> {
    const response = await requestJson<ApiEnvelope<WorkflowDefinitionRecord>>(`${API_ENDPOINTS.workflows}/${id}`, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(workflow),
    });
    return response.data;
  },

  async getWorkflowRun(id: string): Promise<WorkflowRunRecord> {
    const response = await requestJson<ApiEnvelope<WorkflowRunRecord>>(`${API_ENDPOINTS.workflowRuns}/${id}`);
    return response.data;
  },

  async listWorkflowRuns(query: { workflowId?: string; status?: string; taskId?: string } = {}): Promise<WorkflowRunRecord[]> {
    const params = new URLSearchParams();
    if (query.workflowId) params.set('workflowId', query.workflowId);
    if (query.status) params.set('status', query.status);
    if (query.taskId) params.set('taskId', query.taskId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await requestJson<WorkflowRunListEnvelope>(`${API_ENDPOINTS.workflowRuns}${suffix}`);
    return response.data;
  },

  async listHumanTasks(workflowRunId?: string): Promise<HumanTaskRecord[]> {
    const suffix = workflowRunId ? `?workflowRunId=${encodeURIComponent(workflowRunId)}` : '';
    const response = await requestJson<HumanTaskListEnvelope>(`${API_ENDPOINTS.humanTasks}${suffix}`);
    return response.data;
  },

  async respondToHumanTask(id: string, responseValue: unknown): Promise<unknown> {
    const response = await requestJson<ApiEnvelope<unknown>>(`${API_ENDPOINTS.humanTasks}/${id}/respond`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ response: responseValue }),
    });
    return response.data;
  },

  async getThemeSettings(): Promise<ThemeSettings> {
    const response = await requestJson<ApiEnvelope<ThemeSettings>>(API_ENDPOINTS.settingsTheme);
    return response.data;
  },

  async updateThemeSettings(settings: ThemeSettings): Promise<ThemeSettings> {
    const response = await requestJson<ApiEnvelope<ThemeSettings>>(API_ENDPOINTS.settingsTheme, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(settings),
    });
    return response.data;
  },

  async getSettings(): Promise<AppSettings> {
    const response = await requestJson<ApiEnvelope<AppSettings>>(API_ENDPOINTS.settings);
    return response.data;
  },

  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    const response = await requestJson<ApiEnvelope<AppSettings>>(API_ENDPOINTS.settings, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(settings),
    });
    return response.data;
  },
};

export function isTaskStatus(value: string): value is UiTaskStatus {
  return ['pending', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled'].includes(value);
}

export function isTaskPriority(value: string): value is Priority {
  return ['critical', 'high', 'normal', 'batch'].includes(value);
}
