import React, { useState, useEffect } from 'react';
import { Button } from '../components/controls/Button.js';
import { Input } from '../components/forms/Input.js';
import { MultiSelect } from '../components/forms/MultiSelect.js';
import { TextArea } from '../components/forms/TextArea.js';
import { Select } from '../components/forms/Select.js';
import type { AgentMutationInput, AgentRecord, TagRecord } from '../services/index.js';

interface AgentFormProps {
  agent: AgentRecord | null;
  availableTags: TagRecord[];
  onSubmit: (agent: Partial<AgentMutationInput>) => void;
  onCancel: () => void;
}

interface AgentFormState {
  name: string;
  description: string;
  tags: string[];
  complexityBand: 'focused' | 'balanced' | 'demanding' | 'any';
  timeoutMinutes: number;
  iterationCount: number;
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

const metadataTextKeys = ['systemPrompt', 'outputContract', 'toolPolicy', 'notes'] as const;
const DEFAULT_AGENT_TOKEN_PROFILE = {
  min: 100,
  typical: 750,
  max: 1500,
} as const;

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
    tags: agent?.tags ?? [],
    complexityBand: deriveComplexityBand(agent),
    timeoutMinutes: agent ? Number((agent.timeoutMs / 60000).toFixed(2)) : 1,
    iterationCount: agent?.maxRetries ?? 5,
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
  availableTags,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<AgentFormState>(() => createFormState(agent));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(createFormState(agent));
    setError(null);
  }, [agent]);

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

    if (formData.iterationCount < 1 || !Number.isInteger(formData.iterationCount)) {
      setError('Iteration count must be a whole number greater than or equal to 1');
      return;
    }

    if (formData.timeoutMinutes <= 0) {
      setError('Timeout must be greater than 0 minutes');
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
      tags: formData.tags,
      ...complexity,
      tokenProfile: DEFAULT_AGENT_TOKEN_PROFILE,
      timeoutMs: Math.round(formData.timeoutMinutes * 60000),
      maxRetries: formData.iterationCount,
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

          <section className="space-y-4">
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
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <MultiSelect
              label="Tags"
              value={formData.tags}
              onChange={(values) => updateField('tags', values)}
              options={[
                ...availableTags.map((tag) => ({
                  value: tag.id,
                  label: tag.label,
                })),
                ...formData.tags
                  .filter((tagId) => !availableTags.some((tag) => tag.id === tagId))
                  .map((tagId) => ({ value: tagId, label: `${tagId} (legacy)` })),
              ]}
              searchable
              cyberBorder
              placeholder="Select routing tags..."
              helpText="Shared capability tags used for routing and future decomposition."
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
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Timeout (Minutes)"
                type="number"
                min={0.1}
                step={0.1}
                value={formData.timeoutMinutes}
                onChange={(e) => updateField('timeoutMinutes', Number(e.target.value))}
                cyberBorder
                helpText="Decimals are allowed. Example: 0.2 = 12 seconds."
              />
              <Input
                label="Iteration Count"
                type="number"
                min={1}
                step={1}
                value={formData.iterationCount}
                onChange={(e) => updateField('iterationCount', Number(e.target.value))}
                cyberBorder
                helpText="Controls how many tool-use loops the agent can take before it must finish."
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <TextArea
              label="Output Contract"
              value={formData.outputContract}
              onChange={(e) => updateField('outputContract', e.target.value)}
              minRows={3}
              maxRows={6}
              autoGrow
              cyberBorder
              placeholder="Expected answer shape, schemas, or quality bar."
              helpText='Prompt guidance only. It is not automatically validated unless metadata.outputMode = "json" is also configured.'
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
