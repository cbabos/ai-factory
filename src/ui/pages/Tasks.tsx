import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { Select } from '../components/forms/Select.js';
import { Panel } from '../components/layout/Panel.js';
import {
  apiClient,
  isTaskPriority,
  isTaskStatus,
  type TaskDetails,
  type TaskListItem,
} from '../services/index.js';

const TASK_POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 20;

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const priorityOptions = [
  { value: 'all', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'batch', label: 'Batch' },
];

const statusBadgeClasses: Record<TaskListItem['status'], string> = {
  pending: 'border-accent-warning/20 bg-accent-warning/10 text-accent-warning',
  running: 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary',
  completed: 'border-accent-success/20 bg-accent-success/10 text-accent-success',
  failed: 'border-accent-danger/20 bg-accent-danger/10 text-accent-danger',
};

const priorityBadgeClasses: Record<TaskListItem['priority'], string> = {
  critical: 'border-accent-danger/20 bg-accent-danger/10 text-accent-danger',
  high: 'border-accent-warning/20 bg-accent-warning/10 text-accent-warning',
  normal: 'border-accent-secondary/20 bg-accent-secondary/10 text-accent-secondary',
  batch: 'border-accent-primary/20 bg-accent-primary/10 text-accent-primary',
};

function formatCost(cost: number | undefined): string {
  return cost === undefined ? 'n/a' : `$${cost.toFixed(4)}`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? 'n/a' : value.toLocaleString();
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function getShortId(id: string): string {
  return id.length > 10 ? id.slice(-10) : id;
}

function getTaskAge(task: TaskListItem): string {
  const elapsedMs = Date.now() - task.updatedAt;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDetails | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedTaskId = searchParams.get('task');
  const statusFilter = searchParams.get('status') || 'all';
  const priorityFilter = searchParams.get('priority') || 'all';
  const searchTerm = searchParams.get('search') || '';

  const updateSearchParam = useCallback((
    key: string,
    value: string,
    allValue = 'all',
  ) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (!value || value === allValue) {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }
    if (key !== 'task') {
      nextSearchParams.delete('task');
    }
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const fetchTasks = useCallback(async (page = 1) => {
    setLoadingTasks(true);
    setError(null);
    try {
      const data = await apiClient.listTasks({
        page,
        pageSize: PAGE_SIZE,
        status: isTaskStatus(statusFilter) ? statusFilter : undefined,
        priority: isTaskPriority(priorityFilter) ? priorityFilter : undefined,
      });
      setTasks(data.items);
      setTotalPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoadingTasks(false);
    }
  }, [priorityFilter, statusFilter]);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      setSelectedTask(await apiClient.getTask(taskId));
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Failed to load task details');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks(1);
  }, [fetchTasks]);

  useEffect(() => {
    const pollId = window.setInterval(() => {
      void fetchTasks(currentPage);
      if (selectedTaskId) {
        void loadTaskDetails(selectedTaskId);
      }
    }, TASK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(pollId);
    };
  }, [currentPage, fetchTasks, loadTaskDetails, selectedTaskId]);

  const visibleTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter((task) =>
      `${task.id} ${task.description} ${task.originChannel ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [searchTerm, tasks]);

  useEffect(() => {
    if (selectedTaskId) {
      void loadTaskDetails(selectedTaskId);
      return;
    }

    const firstTask = visibleTasks[0];
    if (firstTask) {
      setSelectedTask(null);
      updateSearchParam('task', firstTask.id, '');
    } else {
      setSelectedTask(null);
    }
  }, [loadTaskDetails, selectedTaskId, updateSearchParam, visibleTasks]);

  const handleSelectTask = (taskId: string) => {
    updateSearchParam('task', taskId, '');
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      void fetchTasks(page);
    }
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handleRefresh = () => {
    void fetchTasks(currentPage);
    if (selectedTaskId) {
      void loadTaskDetails(selectedTaskId);
    }
  };

  const statusCounts = useMemo(() => {
    return tasks.reduce<Record<TaskListItem['status'], number>>(
      (counts, task) => ({
        ...counts,
        [task.status]: counts[task.status] + 1,
      }),
      { pending: 0, running: 0, completed: 0, failed: 0 },
    );
  }, [tasks]);

  return (
    <Panel
      title="Tasks"
      subtitle="Monitor task execution, thread history, cost, and token usage"
      padding="md"
      cyber
      glitchEffect
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid w-full gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px] xl:max-w-4xl">
            <Input
              label="Search"
              value={searchTerm}
              onChange={(e) => updateSearchParam('search', e.target.value, '')}
              cyberBorder
              placeholder="Task id, description, origin..."
            />
            <Select
              label="Status"
              value={statusFilter}
              options={statusOptions}
              onChange={(e) => updateSearchParam('status', e.target.value)}
              cyberBorder
            />
            <Select
              label="Priority"
              value={priorityFilter}
              options={priorityOptions}
              onChange={(e) => updateSearchParam('priority', e.target.value)}
              cyberBorder
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="md"
              onClick={handleClearFilters}
              className="h-[46px]"
            >
              Clear
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleRefresh}
              loading={loadingTasks || loadingDetails}
              className="h-[46px]"
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-cyber border border-accent-primary/15 bg-panel/70 px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                {status}
              </div>
              <div className="mt-1 text-xl font-bold text-text-primary">
                {count}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.9fr)]">
          <div className="rounded-cyber border border-accent-primary/20 overflow-hidden bg-panel/70">
            <div className="hidden lg:grid grid-cols-[1.5fr_0.7fr_0.8fr_0.9fr_0.8fr] gap-4 px-5 py-3 bg-accent-primary/5 border-b border-accent-primary/20 text-[11px] font-bold tracking-[0.2em] uppercase text-text-secondary">
              <span>Task</span>
              <span>Status</span>
              <span>Cost</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>

            <div className="min-h-[360px] divide-y divide-accent-primary/10">
              {loadingTasks && tasks.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-text-secondary">
                  Loading tasks...
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-lg font-semibold text-text-primary">No tasks found</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    No task matches the current filters.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                visibleTasks.map((task) => {
                  const isSelected = selectedTask?.id === task.id || selectedTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`px-5 py-4 transition-colors ${
                        isSelected
                          ? 'bg-accent-primary/10'
                          : 'hover:bg-accent-primary/5'
                      }`}
                    >
                      <div className="hidden lg:grid grid-cols-[1.5fr_0.7fr_0.8fr_0.9fr_0.8fr] gap-4 items-start">
                        <button
                          type="button"
                          onClick={() => handleSelectTask(task.id)}
                          className="min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-accent-primary">
                              #{getShortId(task.id)}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${priorityBadgeClasses[task.priority]}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm font-semibold text-text-primary">
                            {task.description}
                          </div>
                          <div className="mt-2 text-xs text-text-secondary">
                            {task.originChannel ?? 'unknown origin'} · created {formatDate(task.createdAt)}
                          </div>
                        </button>

                        <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusBadgeClasses[task.status]}`}>
                          {task.status}
                        </span>

                        <div className="space-y-1 text-xs">
                          <div className="font-mono text-accent-secondary">
                            {formatCost(task.cost)}
                          </div>
                          <div className="font-mono text-accent-tertiary">
                            {formatNumber(task.tokens)} tokens
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-text-secondary">
                          <div>{getTaskAge(task)}</div>
                          <div>{formatDate(task.updatedAt)}</div>
                        </div>

                        <div className="flex flex-col items-stretch gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSelectTask(task.id)}
                          >
                            Inspect
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/tasks/${task.id}`)}
                          >
                            Open
                          </Button>
                        </div>
                      </div>

                      <div className="lg:hidden space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleSelectTask(task.id)}
                            className="min-w-0 text-left"
                          >
                            <div className="text-xs font-mono text-accent-primary">
                              #{getShortId(task.id)}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-text-primary">
                              {task.description}
                            </div>
                          </button>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusBadgeClasses[task.status]}`}>
                            {task.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${priorityBadgeClasses[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                            {formatCost(task.cost)}
                          </span>
                          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                            {formatNumber(task.tokens)} tokens
                          </span>
                          <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] text-accent-secondary">
                            {getTaskAge(task)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSelectTask(task.id)}
                          >
                            Inspect
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/tasks/${task.id}`)}
                          >
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-accent-primary/20 px-5 py-3 text-sm text-text-secondary">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          <aside className="rounded-cyber border border-accent-primary/20 bg-panel/70">
            <div className="border-b border-accent-primary/20 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
                    Thread
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-lg font-bold text-text-primary">
                    {selectedTask?.description ?? 'Select a task'}
                  </h3>
                </div>
                {selectedTask ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusBadgeClasses[selectedTask.status]}`}>
                    {selectedTask.status}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="max-h-[760px] overflow-y-auto px-5 py-4">
              {loadingDetails ? (
                <div className="py-12 text-center text-text-secondary">
                  Loading thread...
                </div>
              ) : detailsError ? (
                <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
                  {detailsError}
                </div>
              ) : !selectedTask ? (
                <div className="py-12 text-center text-text-secondary">
                  Select a task to inspect its conversation.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted">Cost</div>
                      <div className="mt-1 font-mono text-accent-secondary">
                        {formatCost(selectedTask.cost)}
                      </div>
                    </div>
                    <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted">Tokens</div>
                      <div className="mt-1 font-mono text-accent-tertiary">
                        {formatNumber(selectedTask.tokens)}
                      </div>
                    </div>
                    <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted">Origin</div>
                      <div className="mt-1 text-text-primary">
                        {selectedTask.originChannel ?? 'unknown'}
                      </div>
                    </div>
                    <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-text-muted">Priority</div>
                      <div className="mt-1 text-text-primary">
                        {selectedTask.priority}
                      </div>
                    </div>
                  </div>

                  {selectedTask.output !== undefined ? (
                    <div>
                      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        Output
                      </div>
                      <pre className="max-h-52 overflow-auto rounded-cyber border border-accent-primary/15 bg-bg-secondary/40 p-3 text-xs text-text-secondary">
                        {typeof selectedTask.output === 'string'
                          ? selectedTask.output
                          : JSON.stringify(selectedTask.output, null, 2)}
                      </pre>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        Conversation
                      </div>
                      <span className="text-xs text-text-secondary">
                        {selectedTask.conversation.length} entries
                      </span>
                    </div>

                    {selectedTask.conversation.length === 0 ? (
                      <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-4 py-8 text-center text-sm text-text-secondary">
                        No conversation captured for this task yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedTask.conversation.map((turn, index) => (
                          <article
                            key={`${turn.timestamp}-${index}`}
                            className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                                {turn.role}
                              </span>
                              <span className="text-xs text-text-secondary">
                                {formatDate(turn.timestamp)}
                              </span>
                            </div>
                            <div className="prose prose-invert max-w-none text-sm text-text-primary prose-pre:bg-panel/70 prose-pre:border prose-pre:border-accent-primary/20 prose-code:text-accent-secondary prose-headings:text-accent-primary prose-strong:text-text-primary prose-a:text-accent-secondary">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {turn.content}
                              </ReactMarkdown>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Panel>
  );
}
