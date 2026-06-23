import React, { useState, useEffect } from 'react';
import { Input } from '../components/forms/Input.js';
import { Select } from '../components/forms/Select.js';
import { Button } from '../components/common/Button.js';
import type { Provider } from '../../core/types.js';
import type { ModelRecord } from '../services/index.js';

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
  onClose: () => void;
  onSubmit: (modelData: Partial<ModelFormState>) => void;
}

export const ModelForm: React.FC<ModelFormProps> = ({ model, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<ModelFormState>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (model) {
      setFormData({
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
      });
    }
  }, [model]);

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

  const handleAddCapability = () => {
    const cap = prompt('Enter capability (e.g., text-generation, image-generation, coding):');
    if (cap) {
      setFormData(prev => ({
        ...prev,
        capabilities: [...prev.capabilities, cap],
      }));
    }
  };

  const handleRemoveCapability = (capability: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.filter(c => c !== capability),
    }));
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
            options={PROVIDER_OPTIONS}
            onChange={(e) => handleChange('provider', e.target.value as Provider)}
            error={errors.provider}
            cyberBorder
          />

          <Input
            label="Model ID"
            value={formData.modelId}
            onChange={(e) => handleChange('modelId', e.target.value)}
            error={errors.modelId}
            placeholder="e.g., gpt-4, claude-3-opus"
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

          <div>
            <label className="text-xs font-medium text-text-primary tracking-wider uppercase mb-2 block">
              Capabilities
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.capabilities.map(cap => (
                <span
                  key={cap}
                  className="bg-accent-primary/20 text-accent-primary border border-accent-primary/30 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                >
                  {cap}
                  <button
                    type="button"
                    onClick={() => handleRemoveCapability(cap)}
                    className="hover:text-accent-danger transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddCapability}
              startIcon="＋"
            >
              Add Capability
            </Button>
          </div>

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
