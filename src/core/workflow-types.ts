import type {
  ConversationTurn,
  Priority,
  Provider,
  TaskResult,
  TaskExecutionStatus,
  WorkflowReference,
} from "./types.js";

export type WorkflowDefinitionStatus = "draft" | "active" | "archived";
export type WorkflowRunStatus = Extract<
  TaskExecutionStatus,
  "pending" | "running" | "waiting_for_human" | "completed" | "failed" | "cancelled"
>;

export type HumanTaskType = "question" | "approval" | "review";
export type HumanTaskStatus =
  | "pending"
  | "answered"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "cancelled";
export type HumanApprovalDecision = "approved" | "rejected" | "changes_requested";
export type WorkflowArtifactKind = "markdown" | "text" | "json";

export interface HumanQuestionField {
  id: string;
  label: string;
  helpText?: string;
  placeholder?: string;
}

interface WorkflowStepBase {
  id: string;
  name: string;
  description?: string;
  dependsOn?: string[];
}

export interface AgentWorkflowStep extends WorkflowStepBase {
  type: "agent";
  agentId: string;
  instruction: string;
  outputKey?: string;
  capabilityTags?: string[];
  preferredProviders?: Provider[];
  priority?: Priority;
}

export interface HumanInputWorkflowStep extends WorkflowStepBase {
  type: "human-input";
  prompt: string;
  outputKey: string;
  assignedTo?: string;
  promptMode?: "freeform" | "questionnaire";
  questions?: HumanQuestionField[];
}

export interface HumanApprovalWorkflowStep extends WorkflowStepBase {
  type: "human-approval";
  prompt: string;
  outputKey?: string;
  assignedTo?: string;
  onChangesRequested?: string;
  onRejected?: string | "fail";
}

export interface SubworkflowWorkflowStep extends WorkflowStepBase {
  type: "subworkflow";
  workflow: WorkflowReference;
  outputKey?: string;
}

export type WorkflowStep =
  | AgentWorkflowStep
  | HumanInputWorkflowStep
  | HumanApprovalWorkflowStep
  | SubworkflowWorkflowStep;

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  status: WorkflowDefinitionStatus;
  description?: string;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStepRunState {
  stepId: string;
  status: WorkflowRunStatus;
  startedAt?: number;
  completedAt?: number;
  output?: unknown;
  error?: string;
  conversation?: ConversationTurn[];
  taskResult?: TaskResult;
  artifactIds?: string[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersion: number;
  taskId: string;
  status: WorkflowRunStatus;
  currentStepId?: string;
  context: Record<string, unknown>;
  stepStates: Record<string, WorkflowStepRunState>;
  artifactIds?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
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
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
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
  promptMode?: "freeform" | "questionnaire";
  questions?: HumanQuestionField[];
  response?: unknown;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}
