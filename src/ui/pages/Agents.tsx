import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel } from '../components/layout/Panel.js';
import { Button } from '../components/controls/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Select } from '../components/forms/Select.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { AgentForm } from './AgentForm.js';
import { apiClient, type AgentMutationInput, type AgentRecord } from '../services/index.js';

interface AgentFilter {
  tags: string[];
  complexity: string;
  isActive: string;
}

const complexityRangeOptions = [
  { value: '', label: 'All' },
  { value: 'low', label: 'Low (1-5)' },
  { value: 'medium', label: 'Medium (3-7)' },
  { value: 'high', label: 'High (5-10)' },
];

const complexityRangeMap: Record<string, [number, number]> = {
  'low': [1, 5],
  'medium': [3, 7],
  'high': [5, 10],
};

function slugifyAgentName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `agent-${Date.now()}`;
}

function createUniqueAgentId(name: string, existingIds: string[]): string {
  const baseId = slugifyAgentName(name);
  const taken = new Set(existingIds);
  if (!taken.has(baseId)) return baseId;

  let suffix = 2;
  while (taken.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

export interface AgentsPageProps {
  title?: string;
  subtitle?: string;
}

const formatAvailabilityLabel = (isActive: boolean): string => {
  return isActive ? 'available' : 'inactive';
};

const formatMinutes = (timeoutMs: number): string => {
  const minutes = timeoutMs / 60000;
  if (minutes >= 10) {
    return `${minutes.toFixed(0)} min timeout`;
  }
  if (minutes >= 1) {
    return `${minutes.toFixed(1).replace(/\.0$/, '')} min timeout`;
  }
  return `${minutes.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')} min timeout`;
};

const AgentsPage: React.FC<AgentsPageProps> = ({
  title = 'Agents',
  subtitle = 'Manage AI agent configurations',
}) => {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null);
  const [filter, setFilter] = useState<AgentFilter>({
    tags: [],
    complexity: '',
    isActive: 'true',
  });

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const agentData = await apiClient.listAgents();
      setAgents(agentData);
      setError(null);
    } catch (err) {
      console.error('Failed to load agents:', err);
      setError('Failed to load agents. Please check the API connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (filter.tags.length > 0) {
        const hasTag = filter.tags.some((tag) => agent.tags.includes(tag));
        if (!hasTag) return false;
      }
      if (filter.complexity) {
        const [min, max] = complexityRangeMap[filter.complexity] || [0, 10];
        if (agent.complexityMin < min || agent.complexityMax > max) {
          return false;
        }
      }
      if (filter.isActive) {
        const isActive = filter.isActive === 'true';
        if (agent.isActive !== isActive) return false;
      }
      return true;
    });
  }, [agents, filter]);

  const handleAdd = () => {
    setEditingAgent(null);
    setShowForm(true);
  };

  const handleEdit = (agent: AgentRecord) => {
    setEditingAgent(agent);
    setShowForm(true);
  };

  const handleDelete = (agentId: string) => {
    setDeletingAgent(agentId);
  };

  const confirmDelete = async () => {
    if (!deletingAgent) return;
    try {
      setLoading(true);
      await apiClient.deleteAgent(deletingAgent);
      setAgents((prev) => prev.filter((a) => a.id !== deletingAgent));
      setError(null);
    } catch (err) {
      console.error('Failed to delete agent:', err);
      setError('Failed to delete agent');
    } finally {
      setDeletingAgent(null);
      setLoading(false);
    }
  };

  const handleFormSubmit = async (agentData: Partial<AgentMutationInput>) => {
    try {
      setLoading(true);
      const id = editingAgent?.id ?? createUniqueAgentId(
        agentData.name || 'Unnamed Agent',
        agents.map((agent) => agent.id),
      );
      const agent: AgentMutationInput = {
        id,
        name: agentData.name || 'Unnamed Agent',
        tags: agentData.tags || [],
        complexityMin: agentData.complexityMin ?? 1,
        complexityMax: agentData.complexityMax ?? 5,
        tokenProfile: agentData.tokenProfile || {
          min: 100,
          max: 1500,
          typical: 750,
        },
        timeoutMs: agentData.timeoutMs ?? 30000,
        maxRetries: agentData.maxRetries ?? 5,
        isActive: agentData.isActive ?? true,
        configSource: agentData.configSource || 'static',
        description: agentData.description,
        metadata: agentData.metadata,
      };

      if (editingAgent) {
        await apiClient.updateAgent(agent.id, agent);
      } else {
        await apiClient.createAgent(agent);
      }

      await loadAgents();
      setShowForm(false);
      setError(null);
    } catch (err) {
      console.error('Failed to save agent:', err);
      setError('Failed to save agent');
    } finally {
      setLoading(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingAgent(null);
  };

  const handleFilterChange = (key: keyof AgentFilter, value: string | string[]) => {
    setFilter((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    agents.forEach((agent) => agent.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [agents]);

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-12 h-12 mb-4 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          <p className="text-text-secondary">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      padding="md"
      cyber
      glitchEffect
    >
       {error && (
         <Alert
           variant="error"
           title="Error"
           closable
           onClose={() => setError(null)}
         >
           {error}
         </Alert>
       )}

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-text-primary tracking-wider uppercase mb-2 block">
              Filter by Tags
            </label>
            <MultiSelect
              options={allTags.map((tag) => ({ value: tag, label: tag }))}
              value={filter.tags}
              onChange={(values) => handleFilterChange('tags', values)}
              placeholder="Select tags..."
              searchable
              size="md"
              cyberBorder
              glitchEffect
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              label="Complexity Range"
              options={complexityRangeOptions}
              value={filter.complexity}
              onChange={(e) =>
                handleFilterChange('complexity', e.target.value)
              }
              size="md"
              cyberBorder
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              label="Status"
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={filter.isActive}
              onChange={(e) =>
                handleFilterChange('isActive', e.target.value)
              }
              size="md"
              cyberBorder
              glitchEffect
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              startIcon="＋"
              onClick={handleAdd}
              cyberBorder
              glow="strong"
              className="h-[46px]"
            >
              Add Agent
            </Button>
          </div>
        </div>

        <div className="min-h-[400px]">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">👾</div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                No Agents Found
              </h3>
              <p className="text-text-secondary">
                {agents.length === 0
                  ? 'Start by adding your first AI agent.'
                  : 'Try adjusting your filters.'}
              </p>
              {agents.length === 0 && (
                <Button
                  variant="cyber"
                  className="mt-4"
                  onClick={() =>
                    setFilter({ tags: [], complexity: '', isActive: '' })
                  }
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-cyber border border-accent-primary/20 overflow-hidden bg-panel/70">
              <div className="hidden lg:grid grid-cols-[1.8fr_1.1fr_0.8fr] gap-4 px-5 py-3 bg-accent-primary/5 border-b border-accent-primary/20 text-[11px] font-bold tracking-[0.2em] uppercase text-text-secondary">
                <span>Information</span>
                <span>Tags & Models</span>
                <span>Actions</span>
              </div>

              <div className="divide-y divide-accent-primary/10">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="px-5 py-4 hover:bg-accent-primary/5 transition-colors"
                >
                  <div className="hidden lg:grid grid-cols-[1.8fr_1.1fr_0.8fr] gap-6 items-start">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-accent-primary">
                            {agent.configSource === 'custom' ? 'CUSTOM' : 'STATIC'}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                            complexity {agent.complexityMin}-{agent.complexityMax}
                          </span>
                          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                            {formatMinutes(agent.timeoutMs)}
                          </span>
                          <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-secondary">
                            {agent.maxRetries} iterations
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              agent.isActive
                                ? 'border border-accent-success/20 bg-accent-success/10 text-accent-success'
                                : 'border border-accent-danger/20 bg-accent-danger/10 text-accent-danger'
                            }`}
                          >
                            {formatAvailabilityLabel(agent.isActive)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-base font-bold text-text-primary break-all">
                        {agent.name}
                      </div>
                      <div className="text-xs text-text-secondary mt-1 break-all">
                        {agent.id}
                      </div>
                      {agent.description ? (
                        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                          {agent.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {agent.tags.length === 0 ? (
                            <span className="text-xs text-text-muted">No tags</span>
                          ) : (
                            agent.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary"
                              >
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleEdit(agent)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(agent.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="lg:hidden space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-accent-primary">
                          {agent.configSource === 'custom' ? 'CUSTOM' : 'STATIC'}
                        </div>
                        <div className="text-base font-bold text-text-primary mt-1 break-all">
                          {agent.name}
                        </div>
                        <div className="text-xs text-text-secondary mt-1 break-all">
                          {agent.id}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          agent.isActive
                            ? 'border border-accent-success/20 bg-accent-success/10 text-accent-success'
                            : 'border border-accent-danger/20 bg-accent-danger/10 text-accent-danger'
                        }`}
                      >
                        {formatAvailabilityLabel(agent.isActive)}
                      </span>
                    </div>

                    {agent.description ? (
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {agent.description}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                        complexity {agent.complexityMin}-{agent.complexityMax}
                      </span>
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                        {formatMinutes(agent.timeoutMs)}
                      </span>
                      <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-secondary">
                        {agent.maxRetries} iterations
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.tags.length === 0 ? (
                          <span className="text-xs text-text-muted">No tags</span>
                        ) : (
                          agent.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary"
                            >
                              {tag}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(agent)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(agent.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <AgentForm
          agent={editingAgent}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-panel rounded-cyber border border-accent-danger p-6 max-w-md w-full shadow-[0_0_30px_rgba(255,49,49,0.3)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-accent-danger">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-text-primary">
                  Delete Agent
                </h3>
                <p className="text-text-secondary text-sm">
                  This will perform a soft delete of the agent
                </p>
              </div>
            </div>

            <p className="text-text-secondary mb-6">
              Are you sure you want to delete agent '
              <span className="text-accent-primary font-bold">
                {agents.find((a) => a.id === deletingAgent)?.name ||
                  deletingAgent}
              </span>
              '? This will mark the agent as inactive but keep it in the system for recovery if needed.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeletingAgent(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={loading}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
};

AgentsPage.displayName = 'AgentsPage';

export { AgentsPage, AgentForm };
export type { AgentRecord as AgentDTO };
