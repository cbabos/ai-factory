import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Select } from '../components/forms/Select.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import type { AgentMutationInput, AgentRecord, ModelRecord } from '../services/index.js';

interface AgentFormProps {
  agent: AgentRecord | null;
  availableModels: ModelRecord[];
  onSubmit: (agent: Partial<AgentMutationInput>) => void;
  onCancel: () => void;
}

interface AgentFormState {
  name: string;
  description: string;
  tagsText: string;
  complexityBand: 'focused' | 'balanced' | 'demanding' | 'any';
  tokenMin: number;
  tokenTypical: number;
  tokenMax: number;
  preferredModels: string[];
  timeoutMs: number;
  maxRetries: number;
  isActive: boolean;
  systemPrompt: string;
  outputContract: string;
  toolPolicy: string;
  notes: string;
  extraMetadataJson: string;
}

const complexityOptions = [
  { value: 'focused', label: 'Focused (1-4)' },
  { value: 'balanced', label: 'Balanced (3-7)' },
  { value: 'demanding', label: 'Demanding (5-10)' },
  { value: 'any', label: 'Any complexity (1-10)' },
];

const timeoutOptions = [
  { value: '10000', label: '10s' },
  { value: '30000', label: '30s' },
  { value: '60000', label: '60s' },
  { value: '120000', label: '120s' },
];

const retryOptions = [
  { value: '0', label: 'No retries' },
  { value: '1', label: '1 retry' },
  { value: '2', label: '2 retries' },
  { value: '3', label: '3 retries' },
  { value: '5', label: '5 retries' },
];

const metadataTextKeys = ['systemPrompt', 'outputContract', 'toolPolicy', 'notes'] as const;

function stringifyMetadataValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function deriveComplexityBand(agent: AgentRecord | null): AgentFormState['complexityBand'] {
  if (!agent) return 'balanced';
  if (agent.complexityMin <= 1 && agent.complexityMax >= 10) return 'any';
  if (agent.complexityMax <= 4) return 'focused';
  if (agent.complexityMin >= 5) return 'demanding';
  return 'balanced';
}

function mapComplexityBand(
  band: AgentFormState['complexityBand'],
): { complexityMin: number; complexityMax: number } {
  switch (band) {
    case 'focused':
      return { complexityMin: 1, complexityMax: 4 };
    case 'demanding':
      return { complexityMin: 5, complexityMax: 10 };
    case 'any':
      return { complexityMin: 1, complexityMax: 10 };
    case 'balanced':
    default:
      return { complexityMin: 3, complexityMax: 7 };
  }
}

function createFormState(agent: AgentRecord | null): AgentFormState {
  const metadata = agent?.metadata ?? {};
  const extraMetadata = { ...metadata };
  for (const key of metadataTextKeys) {
    delete extraMetadata[key];
  }

  return {
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    tagsText: agent?.tags.join(', ') ?? '',
    complexityBand: deriveComplexityBand(agent),
    tokenMin: agent?.tokenProfile.min ?? 100,
    tokenTypical: agent?.tokenProfile.typical ?? 750,
    tokenMax: agent?.tokenProfile.max ?? 1500,
    preferredModels: agent?.preferredModels ?? [],
    timeoutMs: agent?.timeoutMs ?? 30000,
    maxRetries: agent?.maxRetries ?? 2,
    isActive: agent?.isActive ?? true,
    systemPrompt: stringifyMetadataValue(metadata.systemPrompt),
    outputContract: stringifyMetadataValue(metadata.outputContract),
    toolPolicy: stringifyMetadataValue(metadata.toolPolicy),
    notes: stringifyMetadataValue(metadata.notes),
    extraMetadataJson: Object.keys(extraMetadata).length > 0
      ? JSON.stringify(extraMetadata, null, 2)
      : '',
  };
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
}

function parseExtraMetadata(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Extra metadata must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function withOptionalText(
  metadata: Record<string, unknown>,
  key: string,
  value: string,
): void {
  const trimmed = value.trim();
  if (trimmed) {
    metadata[key] = trimmed;
  }
}

const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  availableModels,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AgentFormState>(() => createFormState(agent));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(createFormState(agent));
    setError(null);
  }, [agent]);

  const modelOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    for (const model of availableModels) {
      options.set(model.modelId, {
        value: model.modelId,
        label: `${model.provider.toUpperCase()} / ${model.modelId}`,
      });
    }
    for (const modelId of formData.preferredModels) {
      if (!options.has(modelId)) {
        options.set(modelId, { value: modelId, label: modelId });
      }
    }
    return Array.from(options.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [availableModels, formData.preferredModels]);

  const updateField = <Key extends keyof AgentFormState>(
    key: Key,
    value: AgentFormState[Key],
  ): void => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = formData.name.trim();
    if (!name) {
      setError('Agent name is required');
      return;
    }

    if (
      formData.tokenMin <= 0 ||
      formData.tokenTypical <= 0 ||
      formData.tokenMax <= 0 ||
      formData.tokenMin > formData.tokenTypical ||
      formData.tokenTypical > formData.tokenMax
    ) {
      setError('Token profile must be ordered as min <= typical <= max');
      return;
    }

    let metadata: Record<string, unknown>;
    try {
      metadata = parseExtraMetadata(formData.extraMetadataJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extra metadata must be valid JSON');
      return;
    }

    withOptionalText(metadata, 'systemPrompt', formData.systemPrompt);
    withOptionalText(metadata, 'outputContract', formData.outputContract);
    withOptionalText(metadata, 'toolPolicy', formData.toolPolicy);
    withOptionalText(metadata, 'notes', formData.notes);

    const complexity = mapComplexityBand(formData.complexityBand);

    onSubmit({
      id: agent?.id,
      name,
      description: formData.description.trim(),
      tags: parseTags(formData.tagsText),
      ...complexity,
      tokenProfile: {
        min: formData.tokenMin,
        typical: formData.tokenTypical,
        max: formData.tokenMax,
      },
      preferredModels: formData.preferredModels,
      timeoutMs: formData.timeoutMs,
      maxRetries: formData.maxRetries,
      isActive: formData.isActive,
      configSource: agent?.configSource ?? 'custom',
      metadata,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-panel rounded-cyber border border-accent-primary max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_0_30px_rgba(0,243,255,0.3)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-accent-primary/20 bg-panel/95 px-6 py-5 backdrop-blur">
          <div>
            <h2 className="text-xl font-bold text-accent-primary">
              {agent ? 'Edit Agent' : 'Add Agent'}
            </h2>
            <p className="text-sm text-text-secondary">
              {agent ? agent.id : 'A stable ID will be generated from the name.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-text-muted hover:text-accent-primary transition-colors"
            aria-label="Close agent form"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {error && (
            <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
              <Input
                label="Name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
                cyberBorder
                placeholder="Search Agent"
              />
              <Select
                label="Status"
                value={formData.isActive ? 'active' : 'inactive'}
                options={[
                  { value: 'active', label: 'Enabled' },
                  { value: 'inactive', label: 'Disabled' },
                ]}
                onChange={(e) => updateField('isActive', e.target.value === 'active')}
                cyberBorder
              />
            </div>

            <TextArea
              label="Description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              minRows={2}
              maxRows={5}
              autoGrow
              cyberBorder
              placeholder="What this agent should be selected for."
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <TextArea
              label="System Prompt"
              value={formData.systemPrompt}
              onChange={(e) => updateField('systemPrompt', e.target.value)}
              minRows={7}
              maxRows={12}
              autoGrow
              cyberBorder
              placeholder="Role, boundaries, and operating instructions for this agent."
            />
            <div className="space-y-4">
              <TextArea
                label="Output Contract"
                value={formData.outputContract}
                onChange={(e) => updateField('outputContract', e.target.value)}
                minRows={3}
                maxRows={6}
                autoGrow
                cyberBorder
                placeholder="Expected answer shape, schemas, or quality bar."
              />
              <TextArea
                label="Tool Policy"
                value={formData.toolPolicy}
                onChange={(e) => updateField('toolPolicy', e.target.value)}
                minRows={3}
                maxRows={6}
                autoGrow
                cyberBorder
                placeholder="Tool preferences, limits, or permissions."
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Input
              label="Tags"
              value={formData.tagsText}
              onChange={(e) => updateField('tagsText', e.target.value)}
              cyberBorder
              placeholder="search, codebase, read-only"
              helpText="Comma-separated capabilities used for routing."
            />
            <Select
              label="Task Complexity"
              value={formData.complexityBand}
              options={complexityOptions}
              onChange={(e) =>
                updateField('complexityBand', e.target.value as AgentFormState['complexityBand'])
              }
              cyberBorder
            />
          </section>

          <section className="space-y-4">
            <MultiSelect
              label="Preferred Models"
              options={modelOptions}
              value={formData.preferredModels}
              onChange={(values) => updateField('preferredModels', values)}
              placeholder={modelOptions.length > 0 ? 'Select models...' : 'No models discovered yet'}
              searchable
              maxItems={8}
              cyberBorder
            />

            <div className="grid gap-4 md:grid-cols-5">
              <Input
                label="Min Tokens"
                type="number"
                min={1}
                value={formData.tokenMin}
                onChange={(e) => updateField('tokenMin', Number(e.target.value))}
                cyberBorder
              />
              <Input
                label="Typical"
                type="number"
                min={1}
                value={formData.tokenTypical}
                onChange={(e) => updateField('tokenTypical', Number(e.target.value))}
                cyberBorder
              />
              <Input
                label="Max Tokens"
                type="number"
                min={1}
                value={formData.tokenMax}
                onChange={(e) => updateField('tokenMax', Number(e.target.value))}
                cyberBorder
              />
              <Select
                label="Timeout"
                value={String(formData.timeoutMs)}
                options={timeoutOptions}
                onChange={(e) => updateField('timeoutMs', Number(e.target.value))}
                cyberBorder
              />
              <Select
                label="Retries"
                value={String(formData.maxRetries)}
                options={retryOptions}
                onChange={(e) => updateField('maxRetries', Number(e.target.value))}
                cyberBorder
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <TextArea
              label="Notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              minRows={3}
              maxRows={6}
              autoGrow
              cyberBorder
              placeholder="Operational notes for future editing."
            />
            <TextArea
              label="Extra Metadata JSON"
              value={formData.extraMetadataJson}
              onChange={(e) => updateField('extraMetadataJson', e.target.value)}
              minRows={3}
              maxRows={8}
              autoGrow
              cyberBorder
              placeholder='{"owner":"team-ai"}'
            />
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-accent-primary/20 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onCancel}
              className="sm:min-w-36"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              glow="strong"
              className="sm:min-w-40"
            >
              {agent ? 'Update Agent' : 'Create Agent'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

AgentForm.displayName = 'AgentForm';

export { AgentForm };
