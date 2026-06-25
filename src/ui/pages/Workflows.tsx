import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBeforeUnload, useBlocker, useNavigate } from 'react-router-dom';
import { appRoutes } from '../app-routes.js';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { Select } from '../components/forms/Select.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Panel } from '../components/layout/Panel.js';
import {
  computeWorkflowGraphAutoLayout,
  WorkflowGraph,
  WorkflowStepEditor,
  validateWorkflowSteps,
  type WorkflowValidationIssue,
} from '../components/workflow/index.js';
import {
  apiClient,
  type AgentRecord,
  type TagRecord,
  type WorkflowDefinitionRecord,
  type WorkflowDefinitionStatus,
  type WorkflowRunRecord,
  type WorkflowStepRecord,
} from '../services/index.js';

const workflowStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

interface WorkflowEditorState {
  id: string;
  name: string;
  version: string;
  status: WorkflowDefinitionStatus;
  description: string;
  steps: WorkflowStepRecord[];
  metadata: Record<string, unknown>;
  stepsJson: string;
  metadataJson: string;
}

type AuthoringMode = 'structured' | 'json';

function slugifyWorkflowId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function workflowStatusTone(status: WorkflowDefinitionStatus): string {
  switch (status) {
    case 'active':
      return 'border-accent-success/30 bg-accent-success/10 text-accent-success';
    case 'archived':
      return 'border-accent-warning/30 bg-accent-warning/10 text-accent-warning';
    case 'draft':
    default:
      return 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary';
  }
}

function workflowStatusLabel(status: WorkflowDefinitionStatus): string {
  return workflowStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function createEmptyEditorState(): WorkflowEditorState {
  return {
    id: '',
    name: '',
    version: '1',
    status: 'draft',
    description: '',
    steps: [],
    metadata: {},
    stepsJson: '[]',
    metadataJson: '{}',
  };
}

function serializeEditorState(editor: WorkflowEditorState): string {
  return JSON.stringify({
    id: editor.id,
    name: editor.name,
    version: editor.version,
    status: editor.status,
    description: editor.description,
    stepsJson: editor.stepsJson,
    metadataJson: editor.metadataJson,
  });
}

function toEditorState(workflow: WorkflowDefinitionRecord): WorkflowEditorState {
  return {
    id: workflow.id,
    name: workflow.name,
    version: String(workflow.version),
    status: workflow.status,
    description: workflow.description ?? '',
    steps: workflow.steps,
    metadata: workflow.metadata ?? {},
    stepsJson: JSON.stringify(workflow.steps, null, 2),
    metadataJson: JSON.stringify(workflow.metadata ?? {}, null, 2),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractGraphLayoutPositions(metadata: Record<string, unknown>): Record<string, { x: number; y: number }> {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);
  const positions = asRecord(graphLayout.positions);
  const result: Record<string, { x: number; y: number }> = {};

  for (const [stepId, value] of Object.entries(positions)) {
    const entry = asRecord(value);
    if (typeof entry.x === 'number' && typeof entry.y === 'number') {
      result[stepId] = { x: entry.x, y: entry.y };
    }
  }

  return result;
}

function extractGraphLayoutLocked(metadata: Record<string, unknown>): boolean {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);
  return graphLayout.locked === true;
}

function withGraphLayoutPosition(
  metadata: Record<string, unknown>,
  stepId: string,
  position: { x: number; y: number },
): Record<string, unknown> {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);
  const positions = asRecord(graphLayout.positions);

  return {
    ...metadata,
    ui: {
      ...ui,
      graphLayout: {
        ...graphLayout,
        positions: {
          ...positions,
          [stepId]: position,
        },
      },
    },
  };
}

function withGraphLayoutPositions(
  metadata: Record<string, unknown>,
  positions: Record<string, { x: number; y: number }>,
): Record<string, unknown> {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);

  return {
    ...metadata,
    ui: {
      ...ui,
      graphLayout: {
        ...graphLayout,
        positions,
      },
    },
  };
}

function withoutGraphLayoutPosition(
  metadata: Record<string, unknown>,
  stepId: string,
): Record<string, unknown> {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);
  const positions = asRecord(graphLayout.positions);
  const nextPositions = { ...positions };
  delete nextPositions[stepId];

  return {
    ...metadata,
    ui: {
      ...ui,
      graphLayout: {
        ...graphLayout,
        positions: nextPositions,
      },
    },
  };
}

function withGraphLayoutLocked(
  metadata: Record<string, unknown>,
  locked: boolean,
): Record<string, unknown> {
  const ui = asRecord(metadata.ui);
  const graphLayout = asRecord(ui.graphLayout);

  return {
    ...metadata,
    ui: {
      ...ui,
      graphLayout: {
        ...graphLayout,
        locked,
      },
    },
  };
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function workflowRunPath(runId: string): string {
  return appRoutes.workflowRunDetails.replace(':runId', runId);
}

function taskPath(taskId: string): string {
  return appRoutes.taskDetails.replace(':taskId', taskId);
}

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinitionRecord[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [editor, setEditor] = useState<WorkflowEditorState>(createEmptyEditorState);
  const [authoringMode, setAuthoringMode] = useState<AuthoringMode>('structured');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [graphModalOpen, setGraphModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeEditorState(createEmptyEditorState()));

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const [agentResponse, tagResponse, workflowResponse, runResponse] = await Promise.all([
        apiClient.listAgents(),
        apiClient.listTags(),
        apiClient.listWorkflows(),
        apiClient.listWorkflowRuns(),
      ]);
      setAgents(agentResponse);
      setTags(tagResponse);
      setWorkflows(workflowResponse);
      setWorkflowRuns(runResponse);
      setError(null);
      if (workflowResponse.length > 0 && !selectedWorkflowId) {
        setSelectedWorkflowId(`${workflowResponse[0]!.id}@${workflowResponse[0]!.version}`);
        const initialEditor = toEditorState(workflowResponse[0]!);
        setEditor(initialEditor);
        setSavedSnapshot(serializeEditorState(initialEditor));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const selectedWorkflow = useMemo(() => {
    return workflows.find((workflow) => `${workflow.id}@${workflow.version}` === selectedWorkflowId) ?? null;
  }, [selectedWorkflowId, workflows]);

  const visibleRuns = useMemo(() => {
    if (!selectedWorkflow) {
      return workflowRuns.slice(0, 8);
    }
    return workflowRuns
      .filter((run) => run.workflowId === selectedWorkflow.id && run.workflowVersion === selectedWorkflow.version)
      .slice(0, 8);
  }, [selectedWorkflow, workflowRuns]);

  const validationIssues = useMemo<WorkflowValidationIssue[]>(() => {
    return validateWorkflowSteps(editor.steps);
  }, [editor.steps]);

  const issuesByStepId = useMemo<Record<string, string[]>>(() => {
    return validationIssues.reduce<Record<string, string[]>>((accumulator, issue) => {
      const current = accumulator[issue.stepId] ?? [];
      accumulator[issue.stepId] = [...current, issue.message];
      return accumulator;
    }, {});
  }, [validationIssues]);

  const hasValidationErrors = useMemo(() => {
    return validationIssues.some((issue) => issue.severity === 'error');
  }, [validationIssues]);

  const isDirty = useMemo(() => {
    return serializeEditorState(editor) !== savedSnapshot;
  }, [editor, savedSnapshot]);

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) {
      return true;
    }

    return window.confirm(
      'You have unsaved workflow changes. Leave this page and lose those edits?',
    );
  }, [isDirty]);

  const graphLayoutPositions = useMemo(() => {
    return extractGraphLayoutPositions(editor.metadata);
  }, [editor.metadata]);

  const graphLayoutLocked = useMemo(() => {
    return extractGraphLayoutLocked(editor.metadata);
  }, [editor.metadata]);

  useEffect(() => {
    if (editor.steps.length === 0) {
      setSelectedStepId(null);
      return;
    }

    if (!selectedStepId || !editor.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(editor.steps[0]?.id ?? null);
    }
  }, [editor.steps, selectedStepId]);

  useBeforeUnload(
    useCallback((event) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }, [isDirty]),
  );

  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return;
    }

    if (window.confirm('You have unsaved workflow changes. Leave this page and lose those edits?')) {
      blocker.proceed();
      return;
    }

    blocker.reset();
  }, [blocker]);

  const handleSelectWorkflow = (workflow: WorkflowDefinitionRecord) => {
    if (!confirmDiscardChanges()) {
      return;
    }

    const nextEditor = toEditorState(workflow);
    setSelectedWorkflowId(`${workflow.id}@${workflow.version}`);
    setEditor(nextEditor);
    setSavedSnapshot(serializeEditorState(nextEditor));
    setStatusMenuOpen(false);
    setSaveMessage(null);
    setError(null);
  };

  const handleNewWorkflow = () => {
    if (!confirmDiscardChanges()) {
      return;
    }

    const emptyEditor = createEmptyEditorState();
    setSelectedWorkflowId(null);
    setEditor(emptyEditor);
    setSavedSnapshot(serializeEditorState(emptyEditor));
    setStatusMenuOpen(false);
    setSaveMessage(null);
    setError(null);
  };

  const navigateWithGuard = useCallback((to: string) => {
    if (!confirmDiscardChanges()) {
      return;
    }

    navigate(to);
  }, [confirmDiscardChanges, navigate]);

  const handleChange = (field: keyof WorkflowEditorState, value: string) => {
    setEditor((current) => ({ ...current, [field]: value }));
  };

  const handleStepsChange = (steps: WorkflowStepRecord[]) => {
    setEditor((current) => ({
      ...current,
      steps,
      stepsJson: JSON.stringify(steps, null, 2),
    }));
  };

  const handleToggleDependency = (dependentStepId: string, dependencyStepId: string) => {
    handleStepsChange(
      editor.steps.map((step) => {
        if (step.id !== dependentStepId) {
          return step;
        }

        const currentDependencies = step.dependsOn ?? [];
        const nextDependencies = currentDependencies.includes(dependencyStepId)
          ? currentDependencies.filter((dependency) => dependency !== dependencyStepId)
          : [...currentDependencies, dependencyStepId];

        return {
          ...step,
          dependsOn: nextDependencies.length > 0 ? nextDependencies : undefined,
        };
      }),
    );
  };

  const handleStepsJsonChange = (value: string) => {
    setEditor((current) => {
      try {
        const parsed = JSON.parse(value) as WorkflowDefinitionRecord['steps'];
        return Array.isArray(parsed)
          ? { ...current, stepsJson: value, steps: parsed }
          : { ...current, stepsJson: value };
      } catch {
        return { ...current, stepsJson: value };
      }
    });
  };

  const handleMetadataJsonChange = (value: string) => {
    setEditor((current) => {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        return {
          ...current,
          metadataJson: value,
          metadata: asRecord(parsed),
        };
      } catch {
        return { ...current, metadataJson: value };
      }
    });
  };

  const handleUpdateNodePosition = (stepId: string, position: { x: number; y: number }) => {
    if (graphLayoutLocked) {
      return;
    }
    setEditor((current) => {
      const nextMetadata = withGraphLayoutPosition(current.metadata, stepId, position);
      return {
        ...current,
        metadata: nextMetadata,
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      };
    });
  };

  const handleResetGraphLayout = () => {
    setEditor((current) => {
      const nextMetadata = withGraphLayoutPositions(current.metadata, {});
      return {
        ...current,
        metadata: nextMetadata,
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      };
    });
  };

  const handleSnapGraphLayout = () => {
    setEditor((current) => {
      const nextMetadata = withGraphLayoutPositions(
        current.metadata,
        computeWorkflowGraphAutoLayout(current.steps),
      );
      return {
        ...current,
        metadata: nextMetadata,
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      };
    });
  };

  const handleToggleGraphLayoutLock = () => {
    setEditor((current) => {
      const nextMetadata = withGraphLayoutLocked(
        current.metadata,
        !extractGraphLayoutLocked(current.metadata),
      );
      return {
        ...current,
        metadata: nextMetadata,
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      };
    });
  };

  const handleResetNodePosition = (stepId: string) => {
    setEditor((current) => {
      const nextMetadata = withoutGraphLayoutPosition(current.metadata, stepId);
      return {
        ...current,
        metadata: nextMetadata,
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const steps = JSON.parse(editor.stepsJson) as WorkflowDefinitionRecord['steps'];
      const metadata = JSON.parse(editor.metadataJson) as Record<string, unknown>;
      const workflowId = (editor.id.trim() || slugifyWorkflowId(editor.name)).trim();
      const workflowVersion = Number(editor.version);

      if (!Array.isArray(steps)) {
        throw new Error('Steps JSON must be an array');
      }
      if (!workflowId || !editor.name.trim()) {
        throw new Error('Workflow name is required');
      }
      if (validateWorkflowSteps(steps).some((issue) => issue.severity === 'error')) {
        throw new Error('Resolve workflow validation errors before saving.');
      }

      const payload = {
        id: workflowId,
        name: editor.name.trim(),
        version: workflowVersion,
        status: editor.status,
        description: editor.description.trim() || undefined,
        steps,
        metadata,
      };

      if (selectedWorkflow) {
        await apiClient.updateWorkflow(selectedWorkflow.id, payload);
        setSaveMessage(`Saved ${selectedWorkflow.id} version ${payload.version}`);
      } else {
        await apiClient.createWorkflow(payload);
        setSaveMessage(`Created workflow ${payload.id}`);
      }

      const [refreshed, refreshedRuns] = await Promise.all([
        apiClient.listWorkflows(),
        apiClient.listWorkflowRuns(),
      ]);
      setWorkflows(refreshed);
      setWorkflowRuns(refreshedRuns);
      const saved = refreshed.find((workflow) => workflow.id === payload.id && workflow.version === payload.version)
        ?? refreshed.find((workflow) => workflow.id === payload.id)
        ?? null;
      if (saved) {
        const nextEditor = toEditorState(saved);
        setSelectedWorkflowId(`${saved.id}@${saved.version}`);
        setEditor(nextEditor);
        setSavedSnapshot(serializeEditorState(nextEditor));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const derivedWorkflowId = editor.id.trim() || slugifyWorkflowId(editor.name) || 'new-workflow';
  const headerVersion = Number(editor.version) || 1;
  const graphWorkspace = (
    <WorkflowGraph
      steps={editor.steps}
      workflows={workflows}
      issues={validationIssues}
      onToggleDependency={handleToggleDependency}
      layoutPositions={graphLayoutPositions}
      onUpdateNodePosition={graphLayoutLocked ? undefined : handleUpdateNodePosition}
      onResetNodePosition={handleResetNodePosition}
      selectedStepId={selectedStepId}
      onSelectStep={setSelectedStepId}
    />
  );

  return (
    <>
      <Panel
      title="Workflows"
      subtitle="Define deterministic pipelines and reusable HITL-enabled execution flows"
      padding="md"
      cyber
      glitchEffect
      >
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Definitions</h3>
              <p className="text-sm text-text-secondary">Versioned workflows stored in the factory database.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleNewWorkflow}>
              New
            </Button>
          </div>

          {loading ? (
            <div className="rounded-cyber border border-accent-primary/20 bg-panel/60 px-4 py-6 text-sm text-text-secondary">
              Loading workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-cyber border border-accent-primary/20 bg-panel/60 px-4 py-6 text-sm text-text-secondary">
              No workflows yet. Create one to start routing tasks deterministically.
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => {
                const isSelected = `${workflow.id}@${workflow.version}` === selectedWorkflowId;
                return (
                  <button
                    key={`${workflow.id}-${workflow.version}`}
                    type="button"
                    onClick={() => handleSelectWorkflow(workflow)}
                    className={`w-full rounded-cyber border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-accent-primary/20 bg-panel/60 hover:border-accent-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text-primary">{workflow.name}</div>
                        <div className="text-xs text-text-secondary">
                          {workflow.id} · v{workflow.version}
                        </div>
                      </div>
                      <span className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                        {workflow.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'} · updated {formatDate(workflow.updatedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
              {error}
            </div>
          ) : null}

          {saveMessage ? (
            <div className="rounded-cyber border border-accent-success/30 bg-accent-success/10 px-4 py-3 text-sm text-accent-success">
              {saveMessage}
            </div>
          ) : null}

          {validationIssues.length > 0 ? (
            <div className="rounded-cyber border border-accent-warning/30 bg-accent-warning/10 px-4 py-3 text-sm text-accent-warning">
              <div className="font-semibold">Workflow validation</div>
              <div className="mb-2 text-xs">
                {validationIssues.filter((issue) => issue.severity === 'error').length} error(s),{' '}
                {validationIssues.filter((issue) => issue.severity === 'warning').length} warning(s)
              </div>
              {validationIssues.map((issue, index) => (
                <div key={`${issue.stepId}-${index}`}>
                  {issue.stepId || 'unnamed-step'}: {issue.message}
                </div>
              ))}
            </div>
          ) : null}

          <Panel
            title={selectedWorkflow ? `Edit ${selectedWorkflow.name}` : 'Create Workflow'}
            subtitle="Structured authoring is now the primary path, with JSON still available as an advanced escape hatch."
            padding="md"
            cyber
          >
            <div className="mb-4 rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold uppercase tracking-[0.12em] text-text-primary">
                    {editor.name.trim() || 'Untitled Workflow'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <span>{derivedWorkflowId}</span>
                    <span className="text-text-muted">v{headerVersion}</span>
                    {!selectedWorkflow ? (
                      <span className="text-text-muted">id auto-derived from name until first save</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedWorkflow ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => navigateWithGuard(
                        `${appRoutes.createTask}?workflowId=${encodeURIComponent(selectedWorkflow.id)}&workflowVersion=${selectedWorkflow.version}`,
                      )}
                    >
                      Open Task Launcher
                    </Button>
                  ) : null}
                  <div className="relative">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors ${workflowStatusTone(editor.status)}`}
                      onClick={() => setStatusMenuOpen((current) => !current)}
                    >
                      {workflowStatusLabel(editor.status)}
                    </button>
                    {statusMenuOpen ? (
                      <div className="absolute right-0 z-10 mt-2 min-w-[140px] rounded-cyber border border-accent-primary/20 bg-panel p-2 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
                        {workflowStatusOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`w-full rounded-[6px] px-3 py-2 text-left text-xs transition-colors ${
                              editor.status === option.value
                                ? 'bg-accent-primary/12 text-accent-primary'
                                : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
                            }`}
                            onClick={() => {
                              handleChange('status', option.value);
                              setStatusMenuOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <Input
                label="Name"
                value={editor.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="Requirements Flow"
              />
            </div>

            <div className="mt-4">
              <Input
                label="Description"
                value={editor.description}
                onChange={(event) => handleChange('description', event.target.value)}
                placeholder="Collect requirements, request clarification, and require approval."
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={authoringMode === 'structured' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setAuthoringMode('structured')}
              >
                Structured Editor
              </Button>
              <Button
                type="button"
                variant={authoringMode === 'json' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setAuthoringMode('json')}
              >
                JSON View
              </Button>
            </div>

            <div className="mt-4">
              {authoringMode === 'structured' ? (
                <div className="space-y-4">
                  <div className="rounded-cyber border border-accent-primary/15 bg-panel/50 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">Workflow Graph</div>
                        <div className="text-xs text-text-secondary">
                          Use this as the planning surface first, then open the full workspace when you need room.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="primary" size="sm" onClick={() => setGraphModalOpen(true)}>
                          Open Fullscreen Graph
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleSnapGraphLayout}>
                          Snap To Lanes
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetGraphLayout}>
                          Reset Auto-Layout
                        </Button>
                        <Button type="button" variant={graphLayoutLocked ? 'secondary' : 'ghost'} size="sm" onClick={handleToggleGraphLayoutLock}>
                          {graphLayoutLocked ? 'Unlock Layout' : 'Lock Layout'}
                        </Button>
                      </div>
                    </div>
                    <div className="mb-3 text-xs text-text-secondary">
                      Click a node to focus its step editor. Use dependency toggles and drag-connect for visual wiring.
                    </div>
                    <div className="max-h-[420px] overflow-hidden">
                      {graphWorkspace}
                    </div>
                  </div>

                  <WorkflowStepEditor
                    agents={agents}
                    availableTags={tags}
                    steps={editor.steps}
                    workflows={workflows}
                    currentWorkflowId={editor.id || selectedWorkflow?.id}
                    issuesByStepId={issuesByStepId}
                    selectedStepId={selectedStepId}
                    onSelectStep={setSelectedStepId}
                    onChange={handleStepsChange}
                  />

                  <details className="rounded-cyber border border-accent-primary/15 bg-panel/50">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-primary">
                      Advanced Metadata
                    </summary>
                    <div className="border-t border-accent-primary/10 p-4">
                      <TextArea
                        label="Metadata JSON"
                        value={editor.metadataJson}
                        onChange={(event) => handleMetadataJsonChange(event.target.value)}
                        autoGrow
                        minRows={10}
                        helpText="Optional workflow metadata for future UI/editor hints."
                      />
                    </div>
                  </details>
                </div>
              ) : (
                <TextArea
                  label="Steps JSON"
                  value={editor.stepsJson}
                  onChange={(event) => handleStepsJsonChange(event.target.value)}
                  autoGrow
                  minRows={14}
                  helpText='Advanced mode. Example step types: "agent", "human-input", "human-approval", "subworkflow".'
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={handleSave} loading={saving} disabled={hasValidationErrors}>
                {selectedWorkflow ? 'Save New Version' : 'Create Workflow'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleNewWorkflow}>
                Reset
              </Button>
              {hasValidationErrors ? (
                <div className="text-sm text-accent-warning">
                  Fix workflow errors before saving.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Recent Workflow Runs"
            subtitle={selectedWorkflow
              ? `Recent runs for ${selectedWorkflow.id} v${selectedWorkflow.version}`
              : 'Recent workflow execution history'}
            padding="md"
            cyber
          >
            {visibleRuns.length === 0 ? (
              <div className="rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-6 text-sm text-text-secondary">
                No workflow runs yet for this selection.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-text-primary">
                          {run.workflowId} v{run.workflowVersion}
                        </div>
                        <div className="text-xs text-text-secondary">
                          run {run.id} · task {run.taskId}
                        </div>
                      </div>
                      <span className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      updated {formatDate(run.updatedAt)} · current step {run.currentStepId ?? 'none'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateWithGuard(workflowRunPath(run.id))}
                      >
                        View Run
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateWithGuard(taskPath(run.taskId))}
                      >
                        Open Task
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
      </Panel>

      {graphModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/88 p-[1vh] backdrop-blur-sm">
          <div className="flex h-[98vh] w-[98vw] flex-col rounded-cyber border border-accent-primary/25 bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-accent-primary/10 px-4 py-3">
              <div>
                <div className="text-base font-semibold text-text-primary">Workflow Graph Workspace</div>
                <div className="text-xs text-text-secondary">
                  {editor.name.trim() || 'Untitled Workflow'} · {derivedWorkflowId} · v{headerVersion}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleSnapGraphLayout}>
                  Snap To Lanes
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetGraphLayout}>
                  Reset Auto-Layout
                </Button>
                <Button type="button" variant={graphLayoutLocked ? 'secondary' : 'ghost'} size="sm" onClick={handleToggleGraphLayoutLock}>
                  {graphLayoutLocked ? 'Unlock Layout' : 'Lock Layout'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setGraphModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {graphWorkspace}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
