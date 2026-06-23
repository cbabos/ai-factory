import React, { useState, useEffect } from 'react';
import { Input } from '../components/forms/Input.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Select } from '../components/forms/Select.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { AgentDTO } from './Agents.js';

interface AgentFormProps {
  agent: AgentDTO | null;
  onSubmit: (agent: Partial<AgentDTO>) => void;
  onCancel: () => void;
}

const complexityRangeOptions = [
  { value: 'low', label: 'Low (1-5)' },
  { value: 'medium', label: 'Medium (3-7)' },
  { value: 'high', label: 'High (5-10)' },
];

const tokenProfileOptions = [
  { value: 'light', label: 'Light (100-500 tokens)' },
  { value: 'medium', label: 'Medium (500-1000 tokens)' },
  { value: 'heavy', label: 'Heavy (1000-3000 tokens)' },
];

const timeoutOptions = [
  { value: 'short', label: 'Short (10s)' },
  { value: 'normal', label: 'Normal (30s)' },
  { value: 'long', label: 'Long (60s)' },
];

const maxRetriesOptions = [
  { value: '0', label: 'No retries' },
  { value: '1', label: '1 retry' },
  { value: '2', label: '2 retries' },
  { value: '3', label: '3 retries' },
];

const configSourceOptions = [
  { value: 'static', label: 'Static (built-in)' },
  { value: 'custom', label: 'Custom (user-defined)' },
];

const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<AgentDTO>>({
    id: agent?.id || '',
    name: agent?.name || '',
    tags: agent?.tags || [],
    complexityMin: agent?.complexityMin || 1,
    complexityMax: agent?.complexityMax || 5,
    tokenProfile: agent?.tokenProfile || { min: 100, max: 1000, typical: 500 },
    preferredModels: agent?.preferredModels || [],
    timeoutMs: agent?.timeoutMs || 30000,
    maxRetries: agent?.maxRetries || 2,
    version: agent?.version || '1.0.0',
    isActive: agent?.isActive ?? true,
    configSource: agent?.configSource || 'static',
    description: agent?.description || '',
    metadata: agent?.metadata || {},
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setFormData(agent);
    }
  }, [agent]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'complexityMin' || name === 'complexityMax' || name === 'timeoutMs' || name === 'maxRetries'
          ? Number(value)
          : value,
    }));
  };

  const handleTagsChange = (values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      tags: values,
    }));
  };

  const handlePreferredModelsChange = (values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      preferredModels: values,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError('Agent name is required');
      return;
    }
    if (!formData.id?.trim()) {
      setError('Agent ID is required');
      return;
    }

    onSubmit(formData);
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-panel rounded-cyber border border-accent-primary p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_30px_rgba(0,243,255,0.3)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-accent-primary">
                {agent ? 'Edit Agent' : 'Add Agent'}
              </h2>
              <p className="text-text-secondary text-sm">
                Configure your AI agent settings
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-text-muted hover:text-accent-primary transition-colors"
            >
              <svg
                className="w-6 h-6"
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
          </div>

        {error && (
          <div className="mb-4">
            <div className="text-accent-danger text-sm">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  label="Agent ID"
                  name="id"
                  value={formData.id}
                  onChange={handleChange}
                  required
                  cyberBorder
                  placeholder="e.g., chat-agent-v1"
                  helpText="Unique identifier for this agent"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  cyberBorder
                  placeholder="e.g., Chat Assistant"
                  helpText="Human-readable agent name"
                />
              </div>
            </div>

            <TextArea
              label="Description"
              name="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={3}
              cyberBorder
              placeholder="Describe what this agent does..."
              helpText="Brief description of agent purpose"
            />

            <div>
              <MultiSelect
                label="Tags"
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'chat', label: 'Chat' },
                  { value: 'code', label: 'Code' },
                  { value: 'data', label: 'Data' },
                  { value: 'analysis', label: 'Analysis' },
                  { value: 'automation', label: 'Automation' },
                ]}
                 value={formData.tags || []}
                 onChange={handleTagsChange}
                 placeholder="Select capabilities..."
                 maxItems={10}
                 cyberBorder
                 helpText="Tags to categorize this agent"
              />
            </div>
          </div>

          {/* Complexity and Token Profile */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Select
                  label="Complexity Range"
                  name="complexityMin"
                  options={complexityRangeOptions}
                   value={formData.complexityMin !== undefined ? formData.complexityMin <= 5 ? 'low' : formData.complexityMin <= 7 ? 'medium' : 'high' : 'medium'}
                  onChange={(e) => {
                    const range = complexityRangeOptions.find(opt => opt.value === e.target.value);
                    if (range) {
                      const [min, max] = range.value === 'low' ? [1, 5] : range.value === 'medium' ? [3, 7] : [5, 10];
                      setFormData((prev) => ({
                        ...prev,
                        complexityMin: min,
                        complexityMax: max,
                      }));
                    }
                  }}
                  cyberBorder
                />
              </div>
              <div className="flex-1 opacity-50 pointer-events-none">
                <Input
                  label="Max Complexity"
                  name="complexityMax"
                   value={formData.complexityMax?.toString() ?? '5'}
                  onChange={handleChange}
                  cyberBorder
                  disabled
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Select
                  label="Token Profile"
                  name="tokenProfileTypical"
                  options={tokenProfileOptions}
                   value={formData.tokenProfile ? (formData.tokenProfile.typical <= 500 ? 'light' : formData.tokenProfile.typical <= 1000 ? 'medium' : 'heavy') : 'medium'}
                  onChange={(e) => {
                    const range = tokenProfileOptions.find(opt => opt.value === e.target.value);
                    if (range) {
                      const [min, max, typical] = range.value === 'light' ? [100, 500, 250] : range.value === 'medium' ? [500, 1000, 750] : [1000, 3000, 2000];
                      setFormData((prev) => ({
                        ...prev,
                        tokenProfile: { min, max, typical },
                      }));
                    }
                  }}
                  cyberBorder
                />
              </div>
            </div>
          </div>

          {/* Model and Performance */}
          <div className="space-y-4">
            <div>
              <MultiSelect
                label="Preferred Models"
                options={[
                  { value: 'gpt-4', label: 'GPT-4' },
                  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
                  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
                  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
                  { value: 'gemini-pro', label: 'Gemini Pro' },
                  { value: 'mistral-large', label: 'Mistral Large' },
                  { value: 'llama-3', label: 'Llama 3' },
                ]}
                  value={formData.preferredModels || []}
                 onChange={handlePreferredModelsChange}
                 placeholder="Select preferred models..."
                 maxItems={5}
                 cyberBorder
                 helpText="Preferred LLM models for this agent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label="Timeout"
                  name="timeoutMs"
                  options={timeoutOptions}
                   value={formData.timeoutMs !== undefined ? formData.timeoutMs <= 10000 ? 'short' : formData.timeoutMs <= 30000 ? 'normal' : 'long' : 'normal'}
                  onChange={(e) => {
                    const value = e.target.value;
                    const timeout = value === 'short' ? 10000 : value === 'normal' ? 30000 : 60000;
                    setFormData((prev) => ({
                      ...prev,
                      timeoutMs: timeout,
                    }));
                  }}
                  cyberBorder
                />
              </div>
              <div>
                <Select
                  label="Max Retries"
                  name="maxRetries"
                  options={maxRetriesOptions}
                   value={formData.maxRetries?.toString() ?? '2'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxRetries: parseInt(e.target.value, 10),
                    }))
                  }
                  cyberBorder
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label="Config Source"
                  name="configSource"
                  options={configSourceOptions}
                  value={formData.configSource}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      configSource: e.target.value as 'static' | 'custom',
                    }))
                  }
                  cyberBorder
                />
              </div>
              <div>
                <Input
                  label="Version"
                  name="version"
                  value={formData.version}
                  onChange={handleChange}
                  cyberBorder
                  placeholder="e.g., 1.0.0"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-accent-primary/20">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-cyber border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-cyber bg-accent-primary text-black font-semibold hover:bg-accent-primary/90 shadow-[0_0_10px_rgba(0,243,255,0.6)] transition-all"
            >
              {agent ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

AgentForm.displayName = 'AgentForm';

export { AgentForm };
