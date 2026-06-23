import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ToggleRadioGroup } from '../components/controls/ToggleRadioGroup.js';
import { Badge } from '../components/ui/Badge.js';
import { Card } from '../components/layout/Card.js';
import { Panel } from '../components/layout/Panel.js';
import { API_ENDPOINTS } from '../services/api.js';

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  priority: 'critical' | 'high' | 'normal' | 'batch';
  cost?: number;
  tokens?: number;
}

export interface TasksResponse {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical', cyber: true },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'batch', label: 'Batch' },
];

const STATUS_COLORS = {
  pending: 'cyber' as const,
  running: 'cyber' as const,
  completed: 'default' as const,
  failed: 'glitch' as const,
};

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  
  const statusFilter = searchParams.get('status') || 'all';
  const priorityFilter = searchParams.get('priority') || 'all';
  const pageSize = 20;

  const fetchTasks = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${API_ENDPOINTS.tasks}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data: TasksResponse = await response.json();
      setTasks(data.items);
      setTotalPages(Math.ceil(data.total / pageSize));
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, searchTerm]);

  useEffect(() => {
    fetchTasks(1);
  }, [fetchTasks]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status !== statusFilter) {
      fetchTasks(1);
    }
  }, [searchParams, statusFilter, fetchTasks]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchTasks(page);
    }
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', value);
    }
    setSearchParams(searchParams);
  };

  const handlePriorityChange = (value: string) => {
    if (value === 'all') {
      searchParams.delete('priority');
    } else {
      searchParams.set('priority', value);
    }
    setSearchParams(searchParams);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      searchParams.set('search', value);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
    fetchTasks(1);
  };

  const handleRefresh = () => {
    fetchTasks(currentPage);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="text-text-secondary">Loading tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Panel title="Error" border="default">
        <p className="text-accent-danger">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-accent-primary/10 border border-accent-primary rounded-cyber hover:bg-accent-primary/20 transition-colors"
        >
          Retry
        </button>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-4 py-2 bg-panel border border-accent-primary/30 text-text-primary rounded-cyber focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              ⌘K
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-accent-primary/10 border border-accent-primary/30 rounded-cyber hover:bg-accent-primary/20 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <Panel
        title="Filter Controls"
        cyber={true}
        collapsible={true}
        headerVariant="cyber"
        border="cyber"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleRadioGroup
            label="Status Filter"
            value={statusFilter}
            onChange={handleStatusChange}
            options={statusOptions}
            cyber
            direction="horizontal"
          />
          <ToggleRadioGroup
            label="Priority Filter"
            value={priorityFilter}
            onChange={handlePriorityChange}
            options={priorityOptions}
            cyber
            direction="horizontal"
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4">
        {tasks.length === 0 ? (
          <Panel title="No Tasks Found" cyber={true}>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-accent-muted mb-4">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.001" />
                </svg>
              </div>
              <p className="text-text-secondary">No tasks match your filters</p>
              <button
                onClick={() => {
                  searchParams.delete('status');
                  searchParams.delete('priority');
                  searchParams.delete('search');
                  setSearchParams(searchParams);
                }}
                className="mt-4 text-accent-primary hover:text-accent-secondary transition-colors"
              >
                Clear filters
              </button>
            </div>
          </Panel>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              variant="cyber"
              cyber
              interactive
              title={`#${task.id.slice(-8)} ${task.description}`}
              subtitle={`Created: ${new Date(task.createdAt).toLocaleString()}`}
            >
              <div className="flex justify-between items-center mb-3">
                <Badge variant={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}>
                  {task.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary">Cost:</span>
                  <span className="font-mono text-accent-secondary">
                    ${task.cost?.toFixed(4) ?? 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary">Tokens:</span>
                  <span className="font-mono text-accent-tertiary">
                    {task.tokens?.toLocaleString() ?? 'N/A'}
                  </span>
                </div>
                <Badge variant="cyber">
                  {task.priority}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-panel border border-accent-primary/30 rounded-cyber hover:bg-accent-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-text-secondary">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 bg-panel border border-accent-primary/30 rounded-cyber hover:bg-accent-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
