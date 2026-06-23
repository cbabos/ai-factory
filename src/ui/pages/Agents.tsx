import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel } from '../components/layout/Panel.js';
import { Grid } from '../components/layout/Grid.js';
import { GridItem } from '../components/layout/Grid.js';
import { Card } from '../components/layout/Card.js';
import { Button } from '../components/controls/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { Select } from '../components/forms/Select.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { StatusIndicator } from '../components/ui/StatusIndicator.js';
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

export interface AgentsPageProps {
  title?: string;
  subtitle?: string;
}

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
    isActive: '',
  });

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.listAgents();
      setAgents(data);
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
      const agent: AgentMutationInput = {
        id: agentData.id || `agent-${Date.now()}`,
        name: agentData.name || 'Unnamed Agent',
        tags: agentData.tags || [],
        complexityMin: agentData.complexityMin ?? 1,
        complexityMax: agentData.complexityMax ?? 5,
        tokenProfile: agentData.tokenProfile || {
          min: 100,
          max: 1000,
          typical: 500,
        },
        preferredModels: agentData.preferredModels,
        timeoutMs: agentData.timeoutMs ?? 30000,
        maxRetries: agentData.maxRetries ?? 2,
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

  const handleTagRemove = (tag: string) => {
    setFilter((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
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
      padding="lg"
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
            <div className="flex flex-wrap gap-2 mb-2">
               {filter.tags.map((tag) => (
                 <Badge key={tag} variant="cyber" size="sm">
                   <span className="flex items-center gap-1">
                     {tag}
                     <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="hover:text-accent-danger"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                </Badge>
              ))}
              {filter.tags.length === 0 && (
                <span className="text-text-muted text-sm">No tags selected</span>
              )}
            </div>
            <MultiSelect
              options={allTags.map((tag) => ({ value: tag, label: tag }))}
              value={filter.tags}
              onChange={(values) => handleFilterChange('tags', values)}
              placeholder="Select tags..."
              searchable
              size="sm"
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
            <Grid columns="1" gap="lg" cyber>
              {filteredAgents.map((agent) => (
                <GridItem key={agent.id} span="1">
                  <Card
                     variant="cyber"
                     interactive
                     cyber
                     glitchEffect
                   >
                     <div className="flex justify-between items-center mb-4">
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
                     <div className="flex flex-col gap-3">
                      <div>
                        <h4 className="text-lg font-bold text-accent-primary truncate">
                          {agent.name}
                        </h4>
                        <p className="text-xs text-text-secondary break-all">
                          ID: {agent.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {agent.tags.map((tag) => (
                          <Badge key={tag} variant="cyber" size="sm">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-text-muted block">Complexity</span>
                          <span className="text-text-primary font-mono">
                            {agent.complexityMin}-{agent.complexityMax}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Tokens</span>
                          <span className="text-text-primary font-mono">
                            {agent.tokenProfile.typical}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Timeout</span>
                          <span className="text-text-primary">
                            {(agent.timeoutMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Retries</span>
                          <span className="text-text-primary">
                            {agent.maxRetries}
                          </span>
                        </div>
                      </div>

                      {agent.preferredModels &&
                        agent.preferredModels.length > 0 && (
                          <div>
                            <span className="text-text-muted block text-xs">
                              Preferred Models
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {agent.preferredModels.map((model) => (
                                <Badge key={model} variant="cyber" size="sm">
                                  {model}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="flex items-center gap-2 pt-2 border-t border-accent-primary/20">
                        <StatusIndicator
                          status={agent.isActive ? 'online' : 'offline'}
                          showLabel
                          label={agent.isActive ? 'Active' : 'Inactive'}
                        />
                        <Badge
                          variant={
                            agent.configSource === 'static'
                              ? 'cyber'
                              : 'cyber'
                          }
                          size="sm"
                        >
                          {agent.configSource}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </GridItem>
              ))}
            </Grid>
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
