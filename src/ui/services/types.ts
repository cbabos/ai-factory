import type { ConversationTurn, Priority, Provider } from '../../core/types.js';

export type UiTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentTokenProfile {
  min: number;
  max: number;
  typical: number;
}

export interface AgentRecord {
  id: string;
  name: string;
  tags: string[];
  complexityMin: number;
  complexityMax: number;
  tokenProfile: AgentTokenProfile;
  preferredModels?: string[];
  timeoutMs: number;
  maxRetries: number;
  version: number;
  isActive: boolean;
  configSource: 'static' | 'custom';
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface AgentMutationInput {
  id: string;
  name: string;
  tags: string[];
  complexityMin: number;
  complexityMax: number;
  tokenProfile: AgentTokenProfile;
  preferredModels?: string[];
  timeoutMs: number;
  maxRetries: number;
  isActive?: boolean;
  configSource?: 'static' | 'custom';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelRecord {
  id: string;
  provider: Provider;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: string[];
  ownedBy?: string;
  version: number;
  isActive: boolean;
  discoveredAt?: number;
  configSource: 'static' | 'discovered';
  createdAt: number;
  updatedAt: number;
}

export interface ModelMutationInput {
  provider: Provider;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: string[];
  ownedBy?: string;
  isActive?: boolean;
  configSource?: 'static' | 'discovered';
  discoveredAt?: number;
}

export interface TaskRecord {
  id: string;
  task: {
    id: string;
    description: string;
    priority: Priority;
    origin?: {
      channel?: string;
      replyTo?: string;
      messageId?: string;
    };
    createdAt: number;
  };
  result?: {
    success: boolean;
    totalCost: number;
    totalTokens: {
      total: number;
    };
    conversation?: ConversationTurn[];
    output?: unknown;
  };
  status: UiTaskStatus;
  conversation?: ConversationTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskListItem {
  id: string;
  description: string;
  status: UiTaskStatus;
  createdAt: number;
  updatedAt: number;
  priority: Priority;
  originChannel?: string;
  cost?: number;
  tokens?: number;
}

export interface TaskDetails {
  id: string;
  description: string;
  status: UiTaskStatus;
  priority: Priority;
  createdAt: number;
  updatedAt: number;
  originChannel?: string;
  cost?: number;
  tokens?: number;
  output?: unknown;
  conversation: ConversationTurn[];
}

export interface PaginatedTasks {
  items: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskQuery {
  page?: number;
  pageSize?: number;
  status?: UiTaskStatus;
  priority?: Priority;
}

export interface ThemeSettings {
  theme: 'synthwave84' | 'tokyonight' | 'zenburn';
  uiLayout?: string;
}
