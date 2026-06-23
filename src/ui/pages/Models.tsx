import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '../components/layout/Panel.js';
import { Grid, GridItem } from '../components/layout/Grid.js';
import { Card } from '../components/layout/Card.js';
import { Button } from '../components/common/Button.js';
import { Select } from '../components/forms/Select.js';
import { Badge } from '../components/ui/Badge.js';
import { StatusIndicator } from '../components/ui/StatusIndicator.js';
import { ModelForm } from './ModelForm.js';
import type { Provider } from '../../core/types.js';
import { API_ENDPOINTS } from '../services/api.js';

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'Deepseek' },
];

const PROVIDER_COLORS: Record<Provider, 'primary' | 'secondary' | 'success' | 'neutral'> = {
  openai: 'primary',
  anthropic: 'secondary',
  google: 'success',
  ollama: 'neutral',
  openrouter: 'primary',
  mistral: 'secondary',
  groq: 'primary',
  deepseek: 'success',
  omlx: 'neutral',
};

export interface Model {
  id: string;
  provider: Provider;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: string[];
  ownedBy: string;
  version?: string;
  isActive: boolean;
  discoveredAt?: number;
  configSource?: 'static' | 'discovered';
  createdAt?: number;
  updatedAt?: number;
}

export interface ModelFormState {
  provider: Provider;
  modelId: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  capabilities: string[];
  ownedBy: string;
  isActive: boolean;
  version?: string;
  configSource?: 'static' | 'discovered';
}

export interface ModelsPageProps {
  className?: string;
}

const ModelsPage: React.FC<ModelsPageProps> = ({ className }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<Provider | 'all'>('all');
  const [sortBy, setSortBy] = useState<'cost' | 'tokens' | 'name'>('cost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Model | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.models);
      if (!response.ok) {
        throw new Error('Failed to load models');
      }
      const data = await response.json();
      setModels(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleCreate = async (modelData: Partial<Model>) => {
    try {
      const response = await fetch(API_ENDPOINTS.models, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) {
        throw new Error('Failed to create model');
      }
      await loadModels();
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create model');
    }
  };

  const handleUpdate = async (modelData: Partial<Model>) => {
    if (!editingModel) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.models}/${editingModel.provider}/${editingModel.modelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) {
        throw new Error('Failed to update model');
      }
      await loadModels();
      setEditingModel(null);
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const response = await fetch(`${API_ENDPOINTS.models}/${deleteConfirm.provider}/${deleteConfirm.modelId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete model');
      }
      await loadModels();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const filteredModels = models.filter((model) =>
    filterProvider === 'all' ? true : model.provider === filterProvider
  );

  const sortedModels = [...filteredModels].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'cost':
        return (a.costPer1kInput + a.costPer1kOutput) * multiplier - (b.costPer1kInput + b.costPer1kOutput) * multiplier;
      case 'tokens':
        return (a.maxTokens - b.maxTokens) * multiplier;
      case 'name':
        return a.modelId.localeCompare(b.modelId) * multiplier;
      default:
        return 0;
    }
  });

  const handleEdit = (model: Model) => {
    setEditingModel(model);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (model: Model) => {
    setDeleteConfirm(model);
  };

  const handleAddNew = () => {
    setEditingModel(null);
    setIsFormOpen(true);
  };

  return (
    <Panel
      title="AI Models"
      subtitle="Manage and configure AI model providers"
      border="cyber"
      headerVariant="cyber"
      padding="md"
      cyber
      className={className}
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select
              label="Filter by Provider"
              value={filterProvider}
              options={[
                { value: 'all', label: 'All Providers' },
                ...PROVIDER_OPTIONS,
              ]}
              onChange={(e) => setFilterProvider(e.target.value as Provider | 'all')}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Sort By"
              value={sortBy}
              options={[
                { value: 'cost', label: 'Cost (Low to High)' },
                { value: 'tokens', label: 'Max Tokens' },
                { value: 'name', label: 'Model Name' },
              ]}
              onChange={(e) => setSortBy(e.target.value as 'cost' | 'tokens' | 'name')}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            size="sm"
            startIcon={sortOrder === 'asc' ? '↑' : '↓'}
          >
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleAddNew}
            size="sm"
            startIcon="＋"
          >
            Add Model
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-accent-danger/10 border border-accent-danger/30 rounded-cyber">
          <span className="text-accent-danger">{error}</span>
          <Button
            variant="ghost"
            onClick={() => setError(null)}
            size="sm"
            className="ml-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-accent-primary/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            <span className="text-sm">Loading models...</span>
          </div>
        </div>
      ) : sortedModels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <div className="text-6xl mb-4 opacity-20">🤖</div>
          <p className="text-lg mb-2">No models found</p>
          <p className="text-sm mb-6">Add a model to get started</p>
          <Button variant="cyber" onClick={handleAddNew} startIcon="＋">
            Add First Model
          </Button>
        </div>
      ) : (
        <Grid columns="1" gap="lg" cyber>
          {sortedModels.map((model) => (
            <GridItem key={model.id} span="1">
              <Card
                title={model.modelId}
                subtitle={`${model.provider.toUpperCase()} - ${model.isActive ? 'Online' : 'Offline'}`}
                variant="cyber"
                interactive
                cyber
                size="md"
                padding="lg"
              >
                <div className="flex items-center gap-2 w-full">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(model);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(model);
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <div className="mt-2">
                  <StatusIndicator status={model.isActive ? 'online' : 'offline'} showLabel />
                </div>
              </Card>
            </GridItem>
          ))}
        </Grid>
      )}

      {isFormOpen && (
        <ModelForm
          model={editingModel}
          onClose={() => {
            setIsFormOpen(false);
            setEditingModel(null);
          }}
          onSubmit={editingModel ? handleUpdate : handleCreate}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-panel border border-accent-danger/50 rounded-cyber shadow-[0_0_30px_rgba(255,49,49,0.3)] max-w-md w-full p-6 animate-[fade-in_200ms_ease-out]">
            <h3 className="text-xl font-bold text-accent-danger mb-2">Delete Model?</h3>
            <p className="text-text-secondary mb-4">
              Are you sure you want to soft delete <strong>{deleteConfirm.modelId}</strong> from{' '}
              <strong>{deleteConfirm.provider}</strong>?
            </p>
            <p className="text-sm text-text-muted mb-6 italic">
              Note: This is a soft delete. The model will be marked as inactive but not permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                startIcon="⚠"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
};

export { ModelsPage, ModelForm };
