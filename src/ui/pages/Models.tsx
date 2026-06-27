import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '../components/layout/Panel.js';
import { Button } from '../components/common/Button.js';
import { Select } from '../components/forms/Select.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { ModelForm } from './ModelForm.js';
import type { Provider } from '../../core/types.js';
import { apiClient, type ModelMutationInput, type ModelRecord, type TagRecord } from '../services/index.js';

export interface Model extends ModelRecord {}

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

const formatCost = (value: number): string => {
  return `$${value.toFixed(4)}`;
};

const formatSourceLabel = (configSource: ModelRecord['configSource']): string => {
  return configSource === 'discovered' ? 'discovered' : 'configured';
};

const ModelsPage: React.FC<ModelsPageProps> = ({ className }) => {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<Provider | 'all'>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'cost' | 'tokens' | 'name'>('cost');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Model | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelData, availableModelData, tagData] = await Promise.all([
        apiClient.listModels(),
        apiClient.listAvailableModels(),
        apiClient.listTags(),
      ]);
      setModels(modelData);
      setAvailableModels(availableModelData);
      setTags(tagData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleCreate = async (modelData: Partial<ModelMutationInput>) => {
    try {
      await apiClient.createModel({
        provider: modelData.provider ?? 'openai',
        modelId: modelData.modelId ?? '',
        maxTokens: modelData.maxTokens ?? 4096,
        costPer1kInput: modelData.costPer1kInput ?? 0.001,
        costPer1kOutput: modelData.costPer1kOutput ?? 0.001,
        capabilities: modelData.capabilities ?? [],
        ownedBy: modelData.ownedBy,
        isActive: modelData.isActive ?? true,
        configSource: modelData.configSource ?? 'static',
        discoveredAt: modelData.discoveredAt,
      });
      await loadModels();
      setIsFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create model');
    }
  };

  const handleUpdate = async (modelData: Partial<ModelMutationInput>) => {
    if (!editingModel) return;
    try {
      const nextProvider = modelData.provider ?? editingModel.provider;
      const nextModelId = modelData.modelId ?? editingModel.modelId;
      const isPersistedModel = models.some((model) => model.id === editingModel.id);
      const shouldPromoteDiscoveredModel = editingModel.configSource === 'discovered';

      if (
        nextProvider !== editingModel.provider ||
        nextModelId !== editingModel.modelId
      ) {
        await apiClient.createModel({
          provider: nextProvider,
          modelId: nextModelId,
          maxTokens: modelData.maxTokens ?? editingModel.maxTokens,
          costPer1kInput: modelData.costPer1kInput ?? editingModel.costPer1kInput,
          costPer1kOutput: modelData.costPer1kOutput ?? editingModel.costPer1kOutput,
          capabilities: modelData.capabilities ?? editingModel.capabilities,
          ownedBy: modelData.ownedBy ?? editingModel.ownedBy,
          isActive: modelData.isActive ?? editingModel.isActive,
          configSource: 'static',
          discoveredAt: modelData.discoveredAt ?? editingModel.discoveredAt,
        });
        if (isPersistedModel) {
          await apiClient.deleteModel(editingModel.provider, editingModel.modelId);
        }
      } else if (!isPersistedModel || shouldPromoteDiscoveredModel) {
        await apiClient.createModel({
          provider: nextProvider,
          modelId: nextModelId,
          maxTokens: modelData.maxTokens ?? editingModel.maxTokens,
          costPer1kInput: modelData.costPer1kInput ?? editingModel.costPer1kInput,
          costPer1kOutput: modelData.costPer1kOutput ?? editingModel.costPer1kOutput,
          capabilities: modelData.capabilities ?? editingModel.capabilities,
          ownedBy: modelData.ownedBy ?? editingModel.ownedBy,
          isActive: modelData.isActive ?? editingModel.isActive,
          configSource: 'static',
          discoveredAt: modelData.discoveredAt ?? editingModel.discoveredAt,
        });
      } else {
        await apiClient.updateModel(editingModel.provider, editingModel.modelId, modelData);
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
      await apiClient.deleteModel(deleteConfirm.provider, deleteConfirm.modelId);
      await loadModels();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const managedModelIds = new Set(models.map((model) => model.id));

  const filteredModels = availableModels.filter((model) => {
    if (filterProvider !== 'all' && model.provider !== filterProvider) {
      return false;
    }

    if (filterTags.length > 0 && !filterTags.some((tag) => model.capabilities.includes(tag))) {
      return false;
    }

    return true;
  });

  const providerOptions = Array.from(new Set(availableModels.map((model) => model.provider)))
    .sort((left, right) => left.localeCompare(right))
    .map((provider) => ({
      value: provider,
      label: provider.toUpperCase(),
    }));

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
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-end justify-between">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <Select
              label="Filter by Provider"
              value={filterProvider}
              options={[
                { value: 'all', label: 'All Providers' },
                ...providerOptions,
              ]}
              onChange={(e) => setFilterProvider(e.target.value as Provider | 'all')}
            />
          </div>
          <div className="w-full sm:w-72">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-primary">
              Filter by Tags
            </label>
            <MultiSelect
              options={[
                ...tags
                  .filter((tag) => tag.isActive)
                  .map((tag) => ({
                    value: tag.id,
                    label: tag.label,
                  })),
                ...filterTags
                  .filter((tagId) => !tags.some((tag) => tag.id === tagId))
                  .map((tagId) => ({
                    value: tagId,
                    label: `${tagId} (legacy)`,
                  })),
              ]}
              value={filterTags}
              onChange={setFilterTags}
              placeholder="Select tags..."
              searchable
              cyberBorder
              size="md"
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
        <div className="flex items-end gap-2">
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
          <p className="text-sm mb-6">No configured models are currently available. Use Add Model to choose one from the discovered provider catalog.</p>
          <Button variant="cyber" onClick={handleAddNew} startIcon="＋">
            Add First Model
          </Button>
        </div>
      ) : (
        <div className="rounded-cyber border border-accent-primary/20 overflow-hidden bg-panel/70">
          <div className="hidden lg:grid grid-cols-[1.8fr_1.2fr_0.8fr] gap-4 px-5 py-3 bg-accent-primary/5 border-b border-accent-primary/20 text-[11px] font-bold tracking-[0.2em] uppercase text-text-secondary">
            <span>Information</span>
            <span>Capabilities</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-accent-primary/10">
            {sortedModels.map((model) => {
              const isPersistedModel = managedModelIds.has(model.id);
              return (
              <div
                key={model.id}
                className="px-5 py-4 hover:bg-accent-primary/5 transition-colors"
              >
                <div className="hidden lg:grid grid-cols-[1.8fr_1.2fr_0.8fr] gap-6 items-start">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-accent-primary">
                          {model.provider.toUpperCase()}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                          in {formatCost(model.costPer1kInput)}
                        </span>
                        <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                          out {formatCost(model.costPer1kOutput)}
                        </span>
                        <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                          {model.maxTokens.toLocaleString()} tokens
                        </span>
                        <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-secondary">
                          {formatSourceLabel(model.configSource)}
                        </span>
                        {!isPersistedModel ? (
                          <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                            discovery only
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            model.isActive
                              ? 'border border-accent-success/20 bg-accent-success/10 text-accent-success'
                              : 'border border-accent-danger/20 bg-accent-danger/10 text-accent-danger'
                          }`}
                        >
                          {model.isActive ? 'enabled' : 'disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-base font-bold text-text-primary break-all">
                      {model.modelId}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      {model.ownedBy || 'Unowned'}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
                      <span className="break-all">{model.id}</span>
                      {model.discoveredAt ? (
                        <span>{new Date(model.discoveredAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-h-9 flex-wrap items-start gap-1.5" title={model.capabilities.join(', ')}>
                    {model.capabilities.length === 0 ? (
                      <span className="text-xs text-text-muted">No capabilities</span>
                    ) : (
                      model.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary"
                        >
                          {capability}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleEdit(model)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!isPersistedModel}
                      onClick={() => handleDeleteClick(model)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="lg:hidden space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-accent-primary">
                        {model.provider.toUpperCase()}
                      </div>
                      <div className="text-base font-bold text-text-primary break-all mt-1">
                        {model.modelId}
                      </div>
                      <div className="text-xs text-text-secondary mt-1">
                        {model.ownedBy || 'Unowned'} · {model.maxTokens.toLocaleString()} tokens
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        model.isActive
                          ? 'border border-accent-success/20 bg-accent-success/10 text-accent-success'
                          : 'border border-accent-danger/20 bg-accent-danger/10 text-accent-danger'
                      }`}
                    >
                      {model.isActive ? 'enabled' : 'disabled'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-sm">
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                        in {formatCost(model.costPer1kInput)}
                      </span>
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                        out {formatCost(model.costPer1kOutput)}
                      </span>
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-mono text-text-primary">
                        {model.maxTokens.toLocaleString()} tokens
                      </span>
                      <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-secondary">
                        {formatSourceLabel(model.configSource)}
                      </span>
                      {!isPersistedModel ? (
                        <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                          discovery only
                        </span>
                      ) : null}
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">Capabilities</div>
                    <div className="flex flex-wrap gap-1.5" title={model.capabilities.join(', ')}>
                      {model.capabilities.length === 0 ? (
                        <span className="text-xs text-text-muted">No capabilities</span>
                      ) : (
                        model.capabilities.map((capability) => (
                          <span
                            key={capability}
                            className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary"
                          >
                            {capability}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                    <span className="break-all">{model.id}</span>
                    {model.discoveredAt ? (
                      <span>{new Date(model.discoveredAt).toLocaleDateString()}</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(model)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      disabled={!isPersistedModel}
                      onClick={() => handleDeleteClick(model)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {isFormOpen && (
        <ModelForm
          model={editingModel}
          availableModels={availableModels}
          availableTags={tags}
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
              Are you sure you want to permanently delete <strong>{deleteConfirm.modelId}</strong> from{' '}
              <strong>{deleteConfirm.provider}</strong>?
            </p>
            <p className="text-sm text-text-muted mb-6 italic">
              Note: This action is final and will remove the model record from the system.
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
