import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationTurnView } from '../components/conversation/ConversationTurnView.js';
import { RoutingDiagnosticsView } from '../components/conversation/RoutingDiagnosticsView.js';
import { Button } from '../components/controls/Button.js';
import { Panel } from '../components/layout/Panel.js';
import { WorkflowArtifactList } from '../components/workflow/index.js';
import { appRoutes } from '../app-routes.js';
import { apiClient, type TaskDetails as TaskDetailsRecord } from '../services/index.js';

const TASK_DETAILS_POLL_INTERVAL_MS = 5000;

const TaskDetailsPage: React.FC = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      return;
    }

    try {
      setLoading((currentLoading) => currentLoading || task === null);
      setTask(await apiClient.getTask(taskId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [task, taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    const pollId = window.setInterval(() => {
      void loadTask();
    }, TASK_DETAILS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(pollId);
    };
  }, [loadTask, taskId]);

  if (loading) {
    return <Panel title="Task Details">Loading task thread...</Panel>;
  }

  if (error || !task) {
    return (
      <Panel title="Task Details" border="default">
        <p className="text-accent-danger">{error ?? 'Task not found'}</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-accent-primary">{task.description}</h2>
          <p className="text-text-secondary text-sm">
            {task.status} · {task.priority} · {new Date(task.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          className="text-sm text-accent-primary hover:text-accent-secondary transition-colors"
        >
          Back to Tasks
        </button>
      </div>

      <Panel title="Thread Summary" cyber>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>Origin: {task.originChannel ?? 'unknown'}</div>
          <div>Cost: {task.cost !== undefined ? `$${task.cost.toFixed(4)}` : 'N/A'}</div>
          <div>Tokens: {task.tokens?.toLocaleString() ?? 'N/A'}</div>
        </div>

        {task.workflowId ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2 text-text-primary">
              Workflow: {task.workflowId} v{task.workflowVersion ?? 'latest'}
            </div>
            {task.workflowRunStatus ? (
              <div className="rounded-cyber border border-accent-secondary/15 bg-accent-secondary/10 px-3 py-2 text-accent-secondary">
                Run status: {task.workflowRunStatus}
              </div>
            ) : null}
            {task.workflowRunId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(appRoutes.workflowRunDetails.replace(':runId', task.workflowRunId!))}
              >
                View Workflow Run
              </Button>
            ) : null}
            {task.status === 'waiting_for_human' ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate(appRoutes.humanTasks)}
              >
                Open Human Tasks
              </Button>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Generated Artifacts" cyber>
        <WorkflowArtifactList
          artifacts={task.artifacts ?? []}
          emptyMessage="This task has not produced any saved artifacts yet."
        />
      </Panel>

      <Panel title="Conversation" cyber>
        <div className="flex flex-col gap-4">
          <RoutingDiagnosticsView turns={task.conversation} />
          {task.conversation.length === 0 ? (
            <p className="text-text-secondary">No conversation captured for this task yet.</p>
          ) : (
            task.conversation.map((turn, index) => (
              <ConversationTurnView
                key={`${turn.timestamp}-${index}`}
                turn={turn}
              />
            ))
          )}
        </div>
      </Panel>
    </div>
  );
};

export default TaskDetailsPage;
