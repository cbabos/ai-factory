import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Panel } from '../components/layout/Panel.js';
import { WorkflowArtifactList, WorkflowValueView } from '../components/workflow/index.js';
import { appRoutes } from '../app-routes.js';
import { apiClient, type HumanApprovalDecision, type HumanTaskRecord } from '../services/index.js';

const POLL_INTERVAL_MS = 5000;

interface PromptTreeNode {
  id: string;
  label: string;
  value: unknown;
  children: PromptTreeNode[];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function workflowRunPath(runId: string): string {
  return appRoutes.workflowRunDetails.replace(':runId', runId);
}

function parsePromptSections(prompt: string): {
  instruction: string;
  context: unknown;
  rawContext?: string;
} {
  const marker = 'Current workflow context:';
  const markerIndex = prompt.indexOf(marker);

  if (markerIndex === -1) {
    return {
      instruction: prompt.trim(),
      context: null,
    };
  }

  const instruction = prompt.slice(0, markerIndex).trim();
  const contextText = prompt.slice(markerIndex + marker.length).trim();

  try {
    return {
      instruction,
      context: JSON.parse(contextText) as unknown,
    };
  } catch {
    return {
      instruction,
      context: null,
      rawContext: contextText,
    };
  }
}

function formatNodeLabel(label: string): string {
  return label
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createPromptTreeNodes(task: HumanTaskRecord, prompt: ReturnType<typeof parsePromptSections>): PromptTreeNode[] {
  const nodes: PromptTreeNode[] = [
    {
      id: `${task.id}:instruction`,
      label: 'Action Needed',
      value: prompt.instruction,
      children: [],
    },
  ];

  const taskDescription = isRecord(prompt.context) && typeof prompt.context.taskDescription === 'string'
    ? prompt.context.taskDescription
    : null;

  if (taskDescription) {
    nodes.push({
      id: `${task.id}:summary`,
      label: 'Task Summary',
      value: taskDescription,
      children: [],
    });
  }

  if (prompt.rawContext) {
    nodes.push({
      id: `${task.id}:raw-context`,
      label: 'Raw Context',
      value: prompt.rawContext,
      children: [],
    });
    return nodes;
  }

  if (prompt.context !== null) {
    nodes.push({
      id: `${task.id}:context`,
      label: 'Workflow Context',
      value: prompt.context,
      children: createChildNodes(`${task.id}:context`, prompt.context),
    });
  }

  return nodes;
}

function createChildNodes(parentId: string, value: unknown): PromptTreeNode[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      id: `${parentId}[${index}]`,
      label: `Item ${index + 1}`,
      value: item,
      children: createChildNodes(`${parentId}[${index}]`, item),
    }));
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => ({
      id: `${parentId}.${key}`,
      label: formatNodeLabel(key),
      value: item,
      children: createChildNodes(`${parentId}.${key}`, item),
    }));
  }

  return [];
}

function findNodeById(nodes: PromptTreeNode[], nodeId: string): PromptTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const nested = findNodeById(node.children, nodeId);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function PromptTree({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: PromptTreeNode[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
  depth?: number;
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const isSelected = node.id === selectedId;

        return (
          <div key={node.id} className="space-y-1">
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'border-accent-primary/40 bg-accent-primary/16 text-accent-primary shadow-[0_0_0_1px_rgba(0,243,255,0.15)]'
                  : 'border-transparent text-text-secondary hover:border-accent-primary/15 hover:bg-bg-secondary/35 hover:text-text-primary'
              }`}
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
              onClick={() => onSelect(node.id)}
            >
              <span className={`text-[10px] uppercase tracking-[0.16em] ${
                isSelected ? 'text-accent-primary' : 'text-text-muted'
              }`}>
                {node.children.length > 0 ? 'Node' : 'Field'}
              </span>
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
            </button>
            {node.children.length > 0 ? (
              <PromptTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function HumanTasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<HumanTaskRecord[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [questionnaireResponses, setQuestionnaireResponses] = useState<Record<string, Record<string, string>>>({});
  const [selectedPromptNodeByTaskId, setSelectedPromptNodeByTaskId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await apiClient.listHumanTasks();
      setTasks(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load human tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void loadTasks(false);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [loadTasks]);

  const setResponse = (taskId: string, value: string) => {
    setResponses((current) => ({ ...current, [taskId]: value }));
  };

  const setQuestionResponse = (taskId: string, questionId: string, value: string) => {
    setQuestionnaireResponses((current) => ({
      ...current,
      [taskId]: {
        ...(current[taskId] ?? {}),
        [questionId]: value,
      },
    }));
  };

  const handleSubmit = async (task: HumanTaskRecord, explicitResponse?: unknown) => {
    try {
      setBusyTaskId(task.id);
      setError(null);
      const note = responses[task.id]?.trim();
      const response = task.type === 'question'
        ? task.promptMode === 'questionnaire' && (task.questions?.length ?? 0) > 0
          ? {
              answers: (task.questions ?? []).map((question) => ({
                questionId: question.id,
                label: question.label,
                answer: questionnaireResponses[task.id]?.[question.id]?.trim() ?? '',
              })),
              bulkResponse: note || undefined,
            }
          : (explicitResponse ?? note ?? '')
        : {
            decision: (explicitResponse ?? 'approved') as HumanApprovalDecision,
            notes: note || undefined,
          };
      const result = await apiClient.respondToHumanTask(task.id, response);
      await loadTasks(false);

      const workflowRunId = typeof result === 'object'
        && result !== null
        && 'workflowRunId' in result
        && typeof result.workflowRunId === 'string'
        ? result.workflowRunId
        : typeof result === 'object'
          && result !== null
          && 'output' in result
          && typeof result.output === 'object'
          && result.output !== null
          && 'workflowRunId' in result.output
          && typeof result.output.workflowRunId === 'string'
          ? result.output.workflowRunId
          : task.workflowRunId;

      setResponses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      setQuestionnaireResponses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });

      if (workflowRunId) {
        navigate(workflowRunPath(workflowRunId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to human task');
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <Panel
      title="Human Tasks"
      subtitle="Answer clarification requests, approvals, and review gates so paused workflows can continue."
      padding="md"
      cyber
      glitchEffect
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-cyber border border-accent-primary/20 bg-panel/60 px-4 py-8 text-sm text-text-secondary">
            Loading pending human tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-cyber border border-accent-primary/20 bg-panel/60 px-4 py-8 text-sm text-text-secondary">
            No pending human tasks right now.
          </div>
        ) : (
          tasks.map((task) => (
            (() => {
              const promptSections = parsePromptSections(task.prompt);
              const promptNodes = createPromptTreeNodes(task, promptSections);
              const fallbackNodeId = promptNodes[0]?.id ?? '';
              const selectedNodeId = selectedPromptNodeByTaskId[task.id] ?? fallbackNodeId;
              const selectedNode = findNodeById(promptNodes, selectedNodeId) ?? promptNodes[0] ?? null;

              return (
                <Panel
                  key={task.id}
                  title={task.title}
                  subtitle={`${task.type} · ${task.workflowId} v${task.workflowVersion} · created ${formatDate(task.createdAt)}`}
                  padding="md"
                  cyber
                >
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
                      <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                              Reading Pane
                            </div>
                            <div className="mt-1 text-sm font-semibold text-text-primary">
                              {selectedNode?.label ?? 'Prompt'}
                            </div>
                          </div>
                          {selectedNode ? (
                            <div className="rounded-full border border-accent-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-secondary">
                              {selectedNode.children.length > 0 ? 'Structured' : 'Focused View'}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 max-h-[28rem] overflow-auto pr-1">
                          {selectedNode ? (
                            <WorkflowValueView value={selectedNode.value} />
                          ) : (
                            <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-bg-secondary/20 px-3 py-4 text-sm text-text-secondary">
                              No readable prompt data available for this task.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-cyber border border-accent-primary/15 bg-panel/55 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                            Structure Map
                          </div>
                          <div className="rounded-full border border-accent-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-secondary">
                            Browse
                          </div>
                        </div>
                        <div className="mt-3 max-h-[28rem] overflow-auto pr-1">
                          <PromptTree
                            nodes={promptNodes}
                            selectedId={selectedNodeId}
                            onSelect={(nodeId) => {
                              setSelectedPromptNodeByTaskId((current) => ({
                                ...current,
                                [task.id]: nodeId,
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <WorkflowArtifactList
                      artifacts={task.artifacts ?? []}
                      title="Generated Documents"
                      emptyMessage="No saved documents are attached to this workflow yet."
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Workflow Run"
                        value={task.workflowRunId}
                        readOnly
                      />
                      <Input
                        label="Assigned To"
                        value={task.assignedTo ?? 'unassigned'}
                        readOnly
                      />
                    </div>

                    {task.type === 'question' ? (
                      <div className="space-y-4">
                        {task.promptMode === 'questionnaire' && (task.questions?.length ?? 0) > 0 ? (
                          <div className="space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                              Question List
                            </div>
                            {(task.questions ?? []).map((question) => (
                              <Input
                                key={`${task.id}-${question.id}`}
                                label={question.label}
                                value={questionnaireResponses[task.id]?.[question.id] ?? ''}
                                onChange={(event) => setQuestionResponse(task.id, question.id, event.target.value)}
                                placeholder={question.placeholder ?? 'Answer this question'}
                                helpText={question.helpText}
                              />
                            ))}
                          </div>
                        ) : null}
                        <TextArea
                          label={task.promptMode === 'questionnaire' ? 'Bulk Response' : 'Response'}
                          value={responses[task.id] ?? ''}
                          onChange={(event) => setResponse(task.id, event.target.value)}
                          minRows={5}
                          autoGrow
                          placeholder={task.promptMode === 'questionnaire'
                            ? 'Optional: answer everything in one block instead.'
                            : 'Provide the missing requirement or decision...'}
                          helpText={task.promptMode === 'questionnaire'
                            ? 'Use this when freeform context is easier than answering each field separately.'
                            : undefined}
                        />
                      </div>
                    ) : (
                      <TextArea
                        label="Review Notes"
                        value={responses[task.id] ?? ''}
                        onChange={(event) => setResponse(task.id, event.target.value)}
                        minRows={4}
                        autoGrow
                        placeholder="Optional notes for the workflow run..."
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      {task.type === 'question' ? (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => void handleSubmit(task)}
                          loading={busyTaskId === task.id}
                        >
                          Submit Response
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => void handleSubmit(task, 'approved')}
                            loading={busyTaskId === task.id}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSubmit(task, 'changes_requested')}
                            loading={busyTaskId === task.id}
                          >
                            Request Changes
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => void handleSubmit(task, 'rejected')}
                            loading={busyTaskId === task.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate(workflowRunPath(task.workflowRunId))}
                      >
                        View Run
                      </Button>
                    </div>
                  </div>
                </Panel>
              );
            })()
          ))
        )}
      </div>
    </Panel>
  );
}
