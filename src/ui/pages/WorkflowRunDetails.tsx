import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appRoutes } from '../app-routes.js';
import { ConversationTurnView } from '../components/conversation/ConversationTurnView.js';
import { Button } from '../components/controls/Button.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Panel } from '../components/layout/Panel.js';
import { WorkflowArtifactList, WorkflowValueView } from '../components/workflow/index.js';
import {
  apiClient,
  type HumanApprovalDecision,
  type HumanTaskRecord,
  type WorkflowRunRecord,
  type WorkflowStepStateRecord,
} from '../services/index.js';

const POLL_INTERVAL_MS = 5000;

function formatDate(timestamp: number | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'n/a';
}

function sortStepStates(stepStates: Record<string, WorkflowStepStateRecord>): WorkflowStepStateRecord[] {
  return Object.values(stepStates).sort((left, right) => left.stepId.localeCompare(right.stepId));
}

export default function WorkflowRunDetailsPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<WorkflowRunRecord | null>(null);
  const [humanTasks, setHumanTasks] = useState<HumanTaskRecord[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    if (!runId) {
      return;
    }
    try {
      setLoading((current) => current || run === null);
      const [runRecord, relatedHumanTasks] = await Promise.all([
        apiClient.getWorkflowRun(runId),
        apiClient.listHumanTasks(runId),
      ]);
      setRun(runRecord);
      setHumanTasks(relatedHumanTasks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow run');
    } finally {
      setLoading(false);
    }
  }, [run, runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (!runId) {
      return;
    }
    const timerId = window.setInterval(() => {
      void loadRun();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [loadRun, runId]);

  const orderedSteps = useMemo(() => {
    return run ? sortStepStates(run.stepStates) : [];
  }, [run]);

  const setResponse = (taskId: string, value: string) => {
    setResponses((current) => ({ ...current, [taskId]: value }));
  };

  const handleSubmitHumanTask = useCallback(async (task: HumanTaskRecord, explicitResponse?: unknown) => {
    try {
      setBusyTaskId(task.id);
      setError(null);
      const note = responses[task.id]?.trim();
      const response = task.type === 'question'
        ? (explicitResponse ?? note ?? '')
        : {
            decision: (explicitResponse ?? 'approved') as HumanApprovalDecision,
            notes: note || undefined,
          };
      await apiClient.respondToHumanTask(task.id, response);
      setResponses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      await loadRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to human task');
    } finally {
      setBusyTaskId(null);
    }
  }, [loadRun, responses]);

  if (loading) {
    return <Panel title="Workflow Run">Loading workflow run...</Panel>;
  }

  if (error || !run) {
    return (
      <Panel title="Workflow Run" border="default">
        <p className="text-accent-danger">{error ?? 'Workflow run not found'}</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-accent-primary">
            {run.workflowId} · run {run.id}
          </h2>
          <p className="text-sm text-text-secondary">
            {run.status} · workflow v{run.workflowVersion} · task {run.taskId}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => navigate('/human-tasks')}>
          Back to Human Tasks
        </Button>
      </div>

      <Panel title="Run Summary" cyber>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 text-sm">
          <div>Current Step: {run.currentStepId ?? 'none'}</div>
          <div>Created: {formatDate(run.createdAt)}</div>
          <div>Updated: {formatDate(run.updatedAt)}</div>
          <div>Completed: {formatDate(run.completedAt)}</div>
        </div>
      </Panel>

      <Panel title="Generated Artifacts" cyber>
        <WorkflowArtifactList
          artifacts={run.artifacts ?? []}
          emptyMessage="No saved artifacts are attached to this workflow run yet."
        />
      </Panel>

      <Panel title="Human Tasks" cyber>
        {humanTasks.length === 0 ? (
          <p className="text-text-secondary">No human tasks associated with this run.</p>
        ) : (
          <div className="space-y-3">
            {humanTasks.map((task) => (
              <div key={task.id} className="rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-text-primary">{task.title}</div>
                    <div className="text-xs text-text-secondary">
                      {task.type} · {task.status} · step {task.stepId}
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-cyber border border-accent-primary/10 bg-bg-secondary/30 p-3">
                  <WorkflowValueView value={task.prompt} label="Prompt" />
                </div>
                {task.status === 'pending' ? (
                  <div className="mt-4 space-y-3">
                    <TextArea
                      label={task.type === 'question' ? 'Response' : 'Review Notes'}
                      value={responses[task.id] ?? ''}
                      onChange={(event) => setResponse(task.id, event.target.value)}
                      minRows={task.type === 'question' ? 4 : 3}
                      autoGrow
                      placeholder={
                        task.type === 'question'
                          ? 'Provide the missing requirement or clarification...'
                          : 'Optional notes for this approval gate...'
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {task.type === 'question' ? (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => void handleSubmitHumanTask(task)}
                          loading={busyTaskId === task.id}
                        >
                          Submit Response
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => void handleSubmitHumanTask(task, 'approved')}
                            loading={busyTaskId === task.id}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleSubmitHumanTask(task, 'changes_requested')}
                            loading={busyTaskId === task.id}
                          >
                            Request Changes
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => void handleSubmitHumanTask(task, 'rejected')}
                            loading={busyTaskId === task.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
                {task.response !== undefined ? (
                  <div className="mt-3 rounded-cyber border border-accent-primary/10 bg-bg-secondary/30 p-3">
                    <WorkflowValueView value={task.response} label="Response" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Step Timeline" cyber>
        <div className="space-y-4">
          {orderedSteps.map((step) => (
            <div key={step.stepId} className="rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-text-primary">{step.stepId}</div>
                  <div className="text-xs text-text-secondary">
                    started {formatDate(step.startedAt)} · completed {formatDate(step.completedAt)}
                  </div>
                </div>
                <span className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                  {step.status}
                </span>
              </div>

              {step.error ? (
                <div className="mt-3 rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
                  {step.error}
                </div>
              ) : null}

              {step.output !== undefined ? (
                <div className="mt-3 rounded-cyber border border-accent-primary/10 bg-bg-secondary/30 p-3">
                  <WorkflowValueView value={step.output} label="Output" />
                </div>
              ) : null}

              {step.conversation && step.conversation.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {step.conversation.map((turn, index) => (
                    <ConversationTurnView key={`${step.stepId}-${turn.timestamp}-${index}`} turn={turn} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Workflow Context" cyber>
        <div className="max-h-[36rem] overflow-auto rounded-cyber border border-accent-primary/10 bg-bg-secondary/30 p-4">
          <WorkflowValueView value={run.context} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(appRoutes.humanTasks)}
          >
            Open Human Tasks Inbox
          </Button>
        </div>
      </Panel>
    </div>
  );
}
