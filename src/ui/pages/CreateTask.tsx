import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { appRoutes } from '../app-routes.js';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { Select } from '../components/forms/Select.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Panel } from '../components/layout/Panel.js';
import { apiClient, type WorkflowDefinitionRecord } from '../services/index.js';

type TaskPriority = 'critical' | 'high' | 'normal' | 'batch';

type LaunchMode = 'adaptive' | 'workflow';

const launchModeOptions = [
  { value: 'adaptive', label: 'Adaptive orchestrator' },
  { value: 'workflow', label: 'Workflow template' },
];

const priorityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'batch', label: 'Batch' },
];

function workflowOptionValue(workflow: WorkflowDefinitionRecord): string {
  return `${workflow.id}@${workflow.version}`;
}

function formatWorkflowOption(workflow: WorkflowDefinitionRecord): string {
  return `${workflow.name} (${workflow.id} v${workflow.version})`;
}

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<LaunchMode>('adaptive');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [contextJson, setContextJson] = useState('{}');
  const [workflows, setWorkflows] = useState<WorkflowDefinitionRecord[]>([]);
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState('');
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoadingWorkflows(true);
      const response = await apiClient.listWorkflows();
      const active = response.filter((workflow) => workflow.status === 'active');
      setWorkflows(active);
      const queryWorkflowId = searchParams.get('workflowId');
      const queryWorkflowVersion = searchParams.get('workflowVersion');
      const preselected = active.find((workflow) =>
        workflow.id === queryWorkflowId
        && (queryWorkflowVersion ? String(workflow.version) === queryWorkflowVersion : true),
      ) ?? active[0];
      if (preselected) {
        setSelectedWorkflowKey(workflowOptionValue(preselected));
      }
      if (queryWorkflowId) {
        setMode('workflow');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoadingWorkflows(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const selectedWorkflow = useMemo(() => {
    return workflows.find((workflow) => workflowOptionValue(workflow) === selectedWorkflowKey) ?? null;
  }, [selectedWorkflowKey, workflows]);

  const workflowOptions = workflows.map((workflow) => ({
    value: workflowOptionValue(workflow),
    label: formatWorkflowOption(workflow),
  }));

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!description.trim()) {
        throw new Error('Task description is required');
      }

      const context = JSON.parse(contextJson) as Record<string, unknown>;
      const task = await apiClient.createTask({
        description: description.trim(),
        priority,
        context,
        workflowId: mode === 'workflow' ? selectedWorkflow?.id : undefined,
        workflowVersion: mode === 'workflow' ? selectedWorkflow?.version : undefined,
      });

      navigate(appRoutes.taskDetails.replace(':taskId', task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      title="Create Task"
      subtitle="Launch either an adaptive task or a deterministic workflow-backed run."
      padding="md"
      cyber
      glitchEffect
    >
      <div className="mx-auto max-w-4xl space-y-5">
        {error ? (
          <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
            {error}
          </div>
        ) : null}

        <Panel
          title="Launch Configuration"
          subtitle="Choose how the factory should execute this task."
          padding="md"
          cyber
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Execution Mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as LaunchMode)}
              options={launchModeOptions}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              options={priorityOptions}
            />
          </div>

          {mode === 'workflow' ? (
            <div className="mt-4">
              <Select
                label="Workflow"
                value={selectedWorkflowKey}
                onChange={(event) => setSelectedWorkflowKey(event.target.value)}
                options={workflowOptions}
                helpText={loadingWorkflows ? 'Loading active workflows...' : 'Only active workflow versions are available for direct launch.'}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-3 text-sm text-text-secondary">
              Adaptive mode uses the current estimator/decomposer/orchestrator path and lets the factory choose how to break up the work.
            </div>
          )}
        </Panel>

        <Panel
          title="Task Payload"
          subtitle="Describe the work and provide optional structured JSON context."
          padding="md"
          cyber
        >
          <div className="space-y-4">
            <Input
              label="Task Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Implement release review workflow for the deployment checklist"
            />
            <TextArea
              label="Context JSON"
              value={contextJson}
              onChange={(event) => setContextJson(event.target.value)}
              autoGrow
              minRows={8}
              helpText="Optional structured context available to the orchestrator or workflow steps."
            />
          </div>
        </Panel>

        {mode === 'workflow' && selectedWorkflow ? (
          <Panel
            title="Selected Workflow"
            subtitle="The task will be routed through this deterministic template."
            padding="md"
            cyber
          >
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-text-primary">
                {selectedWorkflow.name} · {selectedWorkflow.id} v{selectedWorkflow.version}
              </div>
              <div className="text-text-secondary">
                {selectedWorkflow.description ?? 'No description provided.'}
              </div>
              <div className="text-text-muted">
                {selectedWorkflow.steps.length} step{selectedWorkflow.steps.length === 1 ? '' : 's'}
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!description.trim() || (mode === 'workflow' && !selectedWorkflow)}
          >
            Queue Task
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(appRoutes.tasks)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Panel>
  );
}
