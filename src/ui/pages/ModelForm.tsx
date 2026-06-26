import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../components/forms/Input.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { Select } from '../components/forms/Select.js';
import { Button } from '../components/common/Button.js';
import type { Provider } from '../../core/types.js';
import { apiClient, type ModelRecord, type TagRecord } from '../services/index.js';

interface ModelFormState {
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

const defaultState: ModelFormState = {
  provider: 'openai',
  modelId: '',
  maxTokens: 4096,
  costPer1kInput: 0.001,
  costPer1kOutput: 0.001,
  capabilities: [],
  ownedBy: '',
  isActive: true,
};

export interface ModelFormProps {
  model?: ModelRecord | null;
  availableModels: ModelRecord[];
  availableTags: TagRecord[];
  onClose: () => void;
  onSubmit: (modelData: Partial<ModelFormState>) => void;
}

export const ModelForm: React.FC<ModelFormProps> = ({
  model,
  availableModels,
  availableTags,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<ModelFormState>(defaultState);
  const [providerModels, setProviderModels] = useState<ModelRecord[]>(availableModels);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerOptions = useMemo(
    () =>
      Array.from(new Set(availableModels.map((availableModel) => availableModel.provider)))
        .sort((left, right) => left.localeCompare(right))
        .map((provider) => ({
          value: provider,
          label: provider.toUpperCase(),
        })),
    [availableModels],
  );

  const availableModelOptions = useMemo(
    () =>
      Array.from(
        new Map(
          providerModels
            .filter((availableModel) => availableModel.provider === formData.provider)
            .sort((left, right) => left.modelId.localeCompare(right.modelId))
            .map((availableModel) => [
              availableModel.modelId,
              {
                value: availableModel.modelId,
                label: availableModel.modelId,
              },
            ]),
        ).values(),
      ),
    [formData.provider, providerModels],
  );

  useEffect(() => {
    setProviderModels(availableModels);
  }, [availableModels]);

  useEffect(() => {
    if (model) {
      const nextFormData: ModelFormState = {
        provider: model.provider || 'openai',
        modelId: model.modelId || '',
        maxTokens: model.maxTokens || 4096,
        costPer1kInput: model.costPer1kInput || 0.001,
        costPer1kOutput: model.costPer1kOutput || 0.001,
        capabilities: model.capabilities || [],
        ownedBy: model.ownedBy || '',
        isActive: model.isActive ?? true,
        version: model.version !== undefined ? String(model.version) : undefined,
        configSource: model.configSource || 'static',
      };
      setFormData((previous) => {
        if (
          previous.provider === nextFormData.provider &&
          previous.modelId === nextFormData.modelId &&
          previous.maxTokens === nextFormData.maxTokens &&
          previous.costPer1kInput === nextFormData.costPer1kInput &&
          previous.costPer1kOutput === nextFormData.costPer1kOutput &&
          previous.ownedBy === nextFormData.ownedBy &&
          previous.isActive === nextFormData.isActive &&
          previous.version === nextFormData.version &&
          previous.configSource === nextFormData.configSource &&
          previous.capabilities.length === nextFormData.capabilities.length &&
          previous.capabilities.every((capability, index) => capability === nextFormData.capabilities[index])
        ) {
          return previous;
        }
        return nextFormData;
      });
      return;
    }

    if (providerOptions.length > 0) {
      setFormData((previous) => ({
        ...previous,
        provider:
          previous.provider === (providerOptions[0]!.value as Provider)
            ? previous.provider
            : (providerOptions[0]!.value as Provider),
      }));
    }
  }, [model, providerOptions]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderModels() {
      try {
        const discoveredModels = await apiClient.listAvailableModels(formData.provider);
        if (!cancelled) {
          setProviderModels(discoveredModels);
        }
      } catch {
        if (!cancelled) {
          setProviderModels(availableModels);
        }
      }
    }

    void loadProviderModels();

    return () => {
      cancelled = true;
    };
  }, [formData.provider, availableModels]);

  useEffect(() => {
    if (availableModelOptions.length === 0) {
      return;
    }

    if (!availableModelOptions.some((option) => option.value === formData.modelId)) {
      setFormData((previous) => ({
        ...previous,
        modelId: availableModelOptions[0]!.value,
      }));
    }
  }, [availableModelOptions, formData.modelId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.modelId.trim()) {
      newErrors.modelId = 'Model ID is required';
    }
    
    if (!formData.provider) {
      newErrors.provider = 'Provider is required';
    }
    
    if (formData.costPer1kInput < 0) {
      newErrors.costPer1kInput = 'Cost cannot be negative';
    }
    
    if (formData.costPer1kOutput < 0) {
      newErrors.costPer1kOutput = 'Cost cannot be negative';
    }
    
    if (formData.maxTokens < 0) {
      newErrors.maxTokens = 'Max tokens cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    onSubmit(formData);
    setIsSubmitting(false);
  };

  const handleChange = (field: keyof ModelFormState, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmitLabel = model ? 'Update Model' : 'Add Model';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fade-in_200ms_ease-out]">
      <form
        onSubmit={handleSubmit}
        className="bg-panel border border-accent-primary/50 rounded-cyber shadow-[0_0_30px_rgba(0,243,255,0.2)] max-w-lg w-full max-h-[90vh] overflow-y-auto animate-[slide-up_300ms_ease-out]"
      >
        <div className="p-6 border-b border-accent-primary/20">
          <h2 className="text-2xl font-bold text-accent-primary tracking-wide flex items-center gap-2">
            {model ? 'Edit Model' : 'Add New Model'}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <Select
            label="Provider"
            value={formData.provider}
            options={providerOptions}
            onChange={(e) => handleChange('provider', e.target.value as Provider)}
            error={errors.provider}
            cyberBorder
          />

          <Select
            label="Model ID"
            value={formData.modelId}
            onChange={(e) => handleChange('modelId', e.target.value)}
            options={availableModelOptions}
            error={errors.modelId}
            helpText="Auto-discovered models for the selected provider."
            cyberBorder
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Tokens"
              type="number"
              value={formData.maxTokens}
              onChange={(e) => handleChange('maxTokens', parseInt(e.target.value) || 0)}
              error={errors.maxTokens}
              cyberBorder
            />
            <Input
              label="Version"
              value={formData.version || ''}
              onChange={(e) => handleChange('version', e.target.value)}
              placeholder="e.g., 1.0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cost Per 1k Input ($)"
              type="number"
              step="0.0001"
              min="0"
              value={formData.costPer1kInput}
              onChange={(e) => handleChange('costPer1kInput', parseFloat(e.target.value) || 0)}
              error={errors.costPer1kInput}
              cyberBorder
            />
            <Input
              label="Cost Per 1k Output ($)"
              type="number"
              step="0.0001"
              min="0"
              value={formData.costPer1kOutput}
              onChange={(e) => handleChange('costPer1kOutput', parseFloat(e.target.value) || 0)}
              error={errors.costPer1kOutput}
              cyberBorder
            />
          </div>

          <Input
            label="Owner"
            value={formData.ownedBy}
            onChange={(e) => handleChange('ownedBy', e.target.value)}
            placeholder="e.g., OpenAI, Anthropic"
          />

          <MultiSelect
            label="Capabilities"
            value={formData.capabilities}
            onChange={(values) => handleChange('capabilities', values)}
            options={[
              ...availableTags
                .filter((tag) => tag.isActive)
                .map((tag) => ({
                  value: tag.id,
                  label: tag.label,
                })),
              ...formData.capabilities
                .filter((capability) => !availableTags.some((tag) => tag.id === capability))
                .map((capability) => ({
                  value: capability,
                  label: `${capability} (legacy)`,
                })),
            ]}
            searchable
            cyberBorder
            placeholder="Select model capabilities..."
            helpText="Shared tags used for routing and later model selection."
          />

          <div className="flex items-center gap-3 p-4 bg-accent-primary/5 rounded-cyber border border-accent-primary/10">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="w-5 h-5 text-accent-primary focus:ring-0 bg-panel border-accent-primary/50"
            />
            <label htmlFor="isActive" className="text-sm text-text-primary">
              Active Model
            </label>
          </div>

          <div className="flex items-center gap-3 p-4 bg-accent-secondary/5 rounded-cyber border border-accent-secondary/10">
            <input
              type="checkbox"
              id="configSourceStatic"
              checked={formData.configSource === 'static'}
              onChange={(e) => handleChange('configSource', e.target.checked ? 'static' : 'discovered')}
              className="w-5 h-5 text-accent-secondary focus:ring-0 bg-panel border-accent-secondary/50"
            />
            <label htmlFor="configSourceStatic" className="text-sm text-text-secondary">
              Configured via Config File (static)
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-accent-primary/20 bg-accent-primary/5 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={isSubmitting}
            startIcon={model ? '💾' : '＋'}
          >
            {handleSubmitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
};
