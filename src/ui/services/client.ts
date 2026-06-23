import type { Priority } from '../../core/types.js';
import { API_ENDPOINTS, API_BASE_URL } from './api.js';
import type {
  AgentMutationInput,
  AgentRecord,
  ModelMutationInput,
  ModelRecord,
  PaginatedTasks,
  TaskDetails,
  TaskListItem,
  TaskQuery,
  TaskRecord,
  ThemeSettings,
  UiTaskStatus,
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
  };
}

function mapTaskRecordToDetails(record: TaskRecord): TaskDetails {
  return {
    ...mapTaskRecordToListItem(record),
    output: record.result?.output,
    conversation: record.conversation ?? record.result?.conversation ?? [],
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
};

export function isTaskStatus(value: string): value is UiTaskStatus {
  return ['pending', 'running', 'completed', 'failed'].includes(value);
}

export function isTaskPriority(value: string): value is Priority {
  return ['critical', 'high', 'normal', 'batch'].includes(value);
}
