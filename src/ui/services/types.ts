import type { ConversationTurn, Priority, Provider } from '../../core/types.js';

export type UiTaskStatus = 'pending' | 'running' | 'waiting_for_human' | 'completed' | 'failed' | 'cancelled';
export type WorkflowDefinitionStatus = 'draft' | 'active' | 'archived';
export type WorkflowRunStatus = UiTaskStatus;
export type HumanTaskType = 'question' | 'approval' | 'review';
export type HumanTaskStatus =
  | 'pending'
  | 'answered'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'cancelled';
export type HumanApprovalDecision = 'approved' | 'rejected' | 'changes_requested';
export type WorkflowArtifactKind = 'markdown' | 'text' | 'json';

export interface HumanQuestionField {
  id: string;
  label: string;
  helpText?: string;
  placeholder?: string;
}

export interface WorkflowArtifactRecord {
  id: string;
  taskId: string;
  workflowRunId: string;
  stepId: string;
  title: string;
  kind: WorkflowArtifactKind;
  mimeType: string;
  fileName: string;
  storagePath: string;
  sizeBytes: number;
  contentUrl: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

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
    workflow?: {
      workflowId: string;
      workflowVersion?: number;
    };
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
  workflowRunId?: string;
  workflowRunStatus?: WorkflowRunStatus;
  artifacts?: WorkflowArtifactRecord[];
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
  workflowId?: string;
  workflowVersion?: number;
  workflowRunId?: string;
  workflowRunStatus?: WorkflowRunStatus;
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
  workflowId?: string;
  workflowVersion?: number;
  workflowRunId?: string;
  workflowRunStatus?: WorkflowRunStatus;
  artifacts?: WorkflowArtifactRecord[];
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

export interface TaskCreateInput {
  description: string;
  priority?: Priority;
  context?: Record<string, unknown>;
  workflowId?: string;
  workflowVersion?: number;
}

export interface ThemeSettings {
  theme: 'synthwave84' | 'tokyonight' | 'zenburn';
  uiLayout?: string;
}

export interface WorkflowStepRecord {
  id: string;
  name: string;
  type: 'agent' | 'human-input' | 'human-approval' | 'subworkflow';
  description?: string;
  dependsOn?: string[];
  agentId?: string;
  instruction?: string;
  prompt?: string;
  promptMode?: 'freeform' | 'questionnaire';
  questions?: HumanQuestionField[];
  outputKey?: string;
  assignedTo?: string;
  onChangesRequested?: string;
  onRejected?: string | 'fail';
  workflow?: {
    workflowId: string;
    workflowVersion?: number;
  };
  capabilityTags?: string[];
  preferredProviders?: Provider[];
  priority?: Priority;
}

export type WorkflowStepType = WorkflowStepRecord['type'];

export interface WorkflowDefinitionRecord {
  id: string;
  name: string;
  version: number;
  status: WorkflowDefinitionStatus;
  description?: string;
  steps: WorkflowStepRecord[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowMutationInput {
  id: string;
  name: string;
  version?: number;
  status?: WorkflowDefinitionStatus;
  description?: string;
  steps: WorkflowStepRecord[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepStateRecord {
  stepId: string;
  status: WorkflowRunStatus;
  startedAt?: number;
  completedAt?: number;
  output?: unknown;
  error?: string;
  conversation?: ConversationTurn[];
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  taskId: string;
  status: WorkflowRunStatus;
  currentStepId?: string;
  context: Record<string, unknown>;
  stepStates: Record<string, WorkflowStepStateRecord>;
  artifacts?: WorkflowArtifactRecord[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface HumanTaskRecord {
  id: string;
  workflowRunId: string;
  workflowId: string;
  workflowVersion: number;
  stepId: string;
  type: HumanTaskType;
  status: HumanTaskStatus;
  title: string;
  prompt: string;
  assignedTo?: string;
  promptMode?: 'freeform' | 'questionnaire';
  questions?: HumanQuestionField[];
  artifacts?: WorkflowArtifactRecord[];
  response?: unknown;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}
