import { useEffect, useState } from 'react';
import { Button } from '../controls/Button.js';
import { Input } from '../forms/Input.js';
import { MultiSelect } from '../forms/MultiSelect.js';
import { Select } from '../forms/Select.js';
import { TextArea } from '../forms/TextArea.js';
import type {
  AgentRecord,
  TagRecord,
  WorkflowDefinitionRecord,
  WorkflowStepRecord,
  WorkflowStepType,
} from '../../services/index.js';

interface WorkflowStepEditorProps {
  agents: AgentRecord[];
  availableTags: TagRecord[];
  steps: WorkflowStepRecord[];
  workflows: WorkflowDefinitionRecord[];
  currentWorkflowId?: string;
  issuesByStepId?: Record<string, string[]>;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  onChange: (steps: WorkflowStepRecord[]) => void;
}

const stepTypeOptions = [
  { value: 'agent', label: 'Agent Step' },
  { value: 'human-input', label: 'Human Input' },
  { value: 'human-approval', label: 'Human Approval' },
  { value: 'subworkflow', label: 'Subworkflow' },
];

const priorityOptions = [
  { value: '', label: 'Default Priority' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'batch', label: 'Batch' },
];

function slugifyQuestionId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeQuestions(
  questions?: Array<{ id: string; label: string; helpText?: string }>,
): string {
  return questions?.map((question) =>
    question.id && question.id !== slugifyQuestionId(question.label)
      ? `${question.id}: ${question.label}`
      : question.label).join('\n') ?? '';
}

function parseQuestions(value: string): Array<{ id: string; label: string }> | undefined {
  const questions = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const separator = line.indexOf(':');
      const hasExplicitId = separator > 0 && separator < line.length - 1;
      const label = hasExplicitId ? line.slice(separator + 1).trim() : line;
      const explicitId = hasExplicitId ? line.slice(0, separator).trim() : '';
      return {
        id: explicitId || slugifyQuestionId(label) || `question-${index + 1}`,
        label,
      };
    });

  return questions.length > 0 ? questions : undefined;
}

function createStepId(type: WorkflowStepType, index: number): string {
  const prefix = type.replace(/[^a-z0-9]+/g, '-');
  return `${prefix}-${index + 1}`;
}

function createDefaultStep(type: WorkflowStepType, index: number): WorkflowStepRecord {
  const id = createStepId(type, index);
  const base = {
    id,
    name: `Step ${index + 1}`,
    type,
    description: '',
    dependsOn: [],
  };

  switch (type) {
    case 'agent':
      return {
        ...base,
        agentId: '',
        instruction: '',
        outputKey: `${id}Result`,
        capabilityTags: [],
        preferredProviders: [],
        priority: undefined,
      };
    case 'human-input':
      return {
        ...base,
        prompt: '',
        outputKey: `${id}Response`,
        assignedTo: '',
        promptMode: 'freeform',
      };
    case 'human-approval':
      return {
        ...base,
        prompt: '',
        outputKey: `${id}Decision`,
        assignedTo: '',
      };
    case 'subworkflow':
      return {
        ...base,
        workflow: {
          workflowId: '',
        },
        outputKey: `${id}Output`,
      };
  }
}

function normalizeStepType(step: WorkflowStepRecord, nextType: WorkflowStepType): WorkflowStepRecord {
  const reset = createDefaultStep(nextType, 0);
  return {
    ...reset,
    id: step.id,
    name: step.name,
    description: step.description,
    dependsOn: step.dependsOn,
  };
}

function workflowOptionValue(workflow: WorkflowDefinitionRecord): string {
  return `${workflow.id}@${workflow.version}`;
}

function parseWorkflowOption(value: string): { workflowId: string; workflowVersion?: number } {
  const [workflowId, version] = value.split('@');
  return {
    workflowId: workflowId ?? '',
    workflowVersion: version ? Number(version) : undefined,
  };
}

function renderTypeSpecificFields(
  step: WorkflowStepRecord,
  updateStep: (patch: Partial<WorkflowStepRecord>) => void,
  agents: AgentRecord[],
  availableTags: TagRecord[],
  workflows: WorkflowDefinitionRecord[],
  allSteps: WorkflowStepRecord[],
  currentWorkflowId?: string,
) {
  if (step.type === 'agent') {
    const agentOptions = [
      { value: '', label: 'Select an agent' },
      ...agents
        .filter((agent) => agent.isActive)
        .map((agent) => ({
          value: agent.id,
          label: `${agent.name} (${agent.id})`,
        })),
    ];

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextArea
            label="Instruction"
            value={step.instruction ?? ''}
            onChange={(event) => updateStep({ instruction: event.target.value })}
            minRows={5}
            autoGrow
            helpText="Available variables: {{task.description}}, {{task.context}}, {{workflow.context}}."
            placeholder="Write the deterministic instructions this agent must follow."
          />
        </div>
        <Select
          label="Agent ID"
          value={step.agentId ?? ''}
          onChange={(event) => updateStep({ agentId: event.target.value })}
          options={agentOptions}
          helpText="Choose the agent that should execute this deterministic step."
        />
        <Input
          label="Output Key"
          value={step.outputKey ?? ''}
          onChange={(event) => updateStep({ outputKey: event.target.value })}
          placeholder="requirementsDraft"
        />
        <MultiSelect
          label="Capability Tags"
          value={step.capabilityTags ?? []}
          onChange={(values) => updateStep({ capabilityTags: values.length > 0 ? values : undefined })}
          options={[
            ...availableTags
              .filter((tag) => tag.isActive)
              .map((tag) => ({
                value: tag.id,
                label: tag.label,
              })),
            ...(step.capabilityTags ?? [])
              .filter((tagId) => !availableTags.some((tag) => tag.id === tagId))
              .map((tagId) => ({
                value: tagId,
                label: `${tagId} (legacy)`,
              })),
          ]}
          searchable
          placeholder="Select capability tags..."
          helpText="Shared capability tags used for routing this step."
        />
        <Select
          label="Priority"
          value={step.priority ?? ''}
          onChange={(event) => updateStep({ priority: event.target.value || undefined })}
          options={priorityOptions}
        />
      </div>
    );
  }

  if (step.type === 'human-input') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Response Mode"
          value={step.promptMode ?? 'freeform'}
          onChange={(event) => updateStep({ promptMode: event.target.value as 'freeform' | 'questionnaire' })}
          options={[
            { value: 'freeform', label: 'Freeform Response' },
            { value: 'questionnaire', label: 'Questionnaire + Bulk' },
          ]}
          helpText="Questionnaire mode renders one field per question plus an optional bulk answer area."
        />
        <Input
          label="Assigned To"
          value={step.assignedTo ?? ''}
          onChange={(event) => updateStep({ assignedTo: event.target.value })}
          placeholder="product-owner"
        />
        <Input
          label="Output Key"
          value={step.outputKey ?? ''}
          onChange={(event) => updateStep({ outputKey: event.target.value })}
          placeholder={step.type === 'human-input' ? 'clarificationAnswer' : 'approvalDecision'}
        />
        {step.promptMode === 'questionnaire' ? (
          <div className="md:col-span-2">
            <TextArea
              label="Questions"
              value={serializeQuestions(step.questions)}
              onChange={(event) => updateStep({ questions: parseQuestions(event.target.value) })}
              minRows={4}
              autoGrow
              placeholder={'Product variants\npricing_model: What pricing structures are needed beyond fixed prices?'}
              helpText='One question per line. Optionally prefix with "id: label".'
            />
          </div>
        ) : null}
        <div className="md:col-span-2">
          <TextArea
            label="Prompt"
            value={step.prompt ?? ''}
            onChange={(event) => updateStep({ prompt: event.target.value })}
            minRows={4}
            autoGrow
            placeholder="Ask the exact question or approval gate prompt presented to the human."
          />
        </div>
      </div>
    );
  }

  if (step.type === 'human-approval') {
    const routeOptions = [
      { value: '', label: 'No reroute configured' },
      ...allSteps
        .filter((candidate) => candidate.id !== step.id)
        .map((candidate) => ({
          value: candidate.id,
          label: `${candidate.name || candidate.id} (${candidate.id})`,
        })),
    ];

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Assigned To"
          value={step.assignedTo ?? ''}
          onChange={(event) => updateStep({ assignedTo: event.target.value })}
          placeholder="product-owner"
        />
        <Input
          label="Output Key"
          value={step.outputKey ?? ''}
          onChange={(event) => updateStep({ outputKey: event.target.value })}
          placeholder="approvalDecision"
        />
        <Select
          label="On Changes Requested"
          value={step.onChangesRequested ?? ''}
          onChange={(event) => updateStep({ onChangesRequested: event.target.value || undefined })}
          options={routeOptions}
          helpText='Choose which earlier step should rerun when the reviewer requests changes.'
        />
        <Select
          label="On Rejected"
          value={step.onRejected ?? 'fail'}
          onChange={(event) => updateStep({ onRejected: event.target.value === 'fail' ? 'fail' : event.target.value || undefined })}
          options={[
            { value: 'fail', label: 'Fail Workflow' },
            ...routeOptions.filter((option) => option.value !== ''),
          ]}
          helpText='Reject can either fail the workflow immediately or reroute to a repair step.'
        />
        <div className="md:col-span-2">
          <TextArea
            label="Prompt"
            value={step.prompt ?? ''}
            onChange={(event) => updateStep({ prompt: event.target.value })}
            minRows={4}
            autoGrow
            placeholder="Ask the human to approve, reject, or request changes with concrete feedback."
          />
        </div>
      </div>
    );
  }

  const nestedWorkflowOptions = [
    { value: '', label: 'Select a nested workflow' },
    ...workflows
      .filter((workflow) => workflow.id !== currentWorkflowId)
      .map((workflow) => ({
        value: workflowOptionValue(workflow),
        label: `${workflow.name} (${workflow.id} v${workflow.version})`,
      })),
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Select
        label="Nested Workflow"
        value={step.workflow?.workflowId ? `${step.workflow.workflowId}@${step.workflow.workflowVersion ?? ''}` : ''}
        onChange={(event) => updateStep({ workflow: parseWorkflowOption(event.target.value) })}
        options={nestedWorkflowOptions}
        helpText="Choose an existing reusable workflow to embed."
      />
      <Input
        label="Output Key"
        value={step.outputKey ?? ''}
        onChange={(event) => updateStep({ outputKey: event.target.value })}
        placeholder="nestedWorkflowOutput"
      />
      <Input
        label="Workflow ID"
        value={step.workflow?.workflowId ?? ''}
        onChange={(event) => updateStep({
          workflow: {
            workflowId: event.target.value,
            workflowVersion: step.workflow?.workflowVersion,
          },
        })}
        placeholder="requirements-clarify-and-approve"
      />
      <Input
        label="Workflow Version"
        type="number"
        min="1"
        value={step.workflow?.workflowVersion ? String(step.workflow.workflowVersion) : ''}
        onChange={(event) => updateStep({
          workflow: {
            workflowId: step.workflow?.workflowId ?? '',
            workflowVersion: event.target.value ? Number(event.target.value) : undefined,
          },
        })}
        placeholder="latest"
      />
    </div>
  );
}

export function WorkflowStepEditor({
  agents,
  availableTags,
  steps,
  workflows,
  currentWorkflowId,
  issuesByStepId = {},
  selectedStepId: selectedStepIdProp,
  onSelectStep,
  onChange,
}: WorkflowStepEditorProps) {
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [internalSelectedStepId, setInternalSelectedStepId] = useState<string | null>(steps[0]?.id ?? null);
  const selectedStepId = selectedStepIdProp ?? internalSelectedStepId;

  const selectStep = (stepId: string | null) => {
    if (stepId !== null) {
      onSelectStep?.(stepId);
    }
    if (selectedStepIdProp === undefined) {
      setInternalSelectedStepId(stepId);
    }
  };

  useEffect(() => {
    if (steps.length === 0) {
      if (selectedStepIdProp === undefined) {
        setInternalSelectedStepId(null);
      }
      return;
    }

    if (!selectedStepId || !steps.some((step) => step.id === selectedStepId)) {
      const fallback = steps[0]?.id ?? null;
      if (fallback) {
        onSelectStep?.(fallback);
      }
      if (selectedStepIdProp === undefined) {
        setInternalSelectedStepId(fallback);
      }
    }
  }, [onSelectStep, selectedStepId, selectedStepIdProp, steps]);

  const updateAtIndex = (index: number, step: WorkflowStepRecord) => {
    const next = [...steps];
    next[index] = step;
    onChange(next);
  };

  const removeAtIndex = (index: number) => {
    const removed = steps[index];
    onChange(steps.filter((_, currentIndex) => currentIndex !== index));
    if (removed && selectedStepId === removed.id) {
      const fallback = steps[index + 1] ?? steps[index - 1] ?? null;
      selectStep(fallback?.id ?? null);
    }
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) {
      return;
    }
    const next = [...steps];
    const [item] = next.splice(index, 1);
    if (!item) {
      return;
    }
    next.splice(targetIndex, 0, item);
    onChange(next);
  };

  const addStep = (type: WorkflowStepType) => {
    const nextStep = createDefaultStep(type, steps.length);
    onChange([...steps, nextStep]);
    selectStep(nextStep.id);
  };

  const reorderToIndex = (sourceStepId: string, targetIndex: number) => {
    const sourceIndex = steps.findIndex((step) => step.id === sourceStepId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const next = [...steps];
    const [item] = next.splice(sourceIndex, 1);
    if (!item) {
      return;
    }
    next.splice(targetIndex, 0, item);
    onChange(next);
  };

  const selectedIndex = selectedStepId
    ? steps.findIndex((step) => step.id === selectedStepId)
    : -1;
  const selectedStep = selectedIndex >= 0 ? steps[selectedIndex] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {stepTypeOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addStep(option.value as WorkflowStepType)}
          >
            Add {option.label}
          </Button>
        ))}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-panel/50 px-4 py-8 text-sm text-text-secondary">
          No steps yet. Start with an agent step, a human checkpoint, or a reusable subworkflow.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-cyber border border-accent-primary/15 bg-panel/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-primary">Step Editor</div>
                <div className="text-xs text-text-secondary">
                  Switch steps here, drag compact cards to reorder, then use the full-width form below.
                </div>
              </div>
              <div className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                {steps.length} total
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  Step Strip
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {steps.map((step, index) => {
                    const stepIssues = issuesByStepId[step.id] ?? [];
                    const issueCount = stepIssues.length;
                    const isSelected = selectedStepId === step.id;

                    return (
                      <button
                        key={`${step.id}-${index}`}
                        type="button"
                        className={`w-full rounded-cyber border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-accent-primary bg-accent-primary/10'
                            : 'border-accent-primary/15 bg-panel/50 hover:border-accent-primary/35'
                        } ${draggedStepId === step.id ? 'opacity-70' : ''}`}
                        draggable
                        onClick={() => selectStep(step.id)}
                        onDragStart={() => setDraggedStepId(step.id)}
                        onDragEnd={() => setDraggedStepId(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedStepId) {
                            reorderToIndex(draggedStepId, index);
                          }
                          setDraggedStepId(null);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-text-primary">
                              {index + 1}. {step.name || step.id}
                            </div>
                            <div className="truncate text-[11px] text-text-secondary">
                              {step.id}
                            </div>
                          </div>
                          <span className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent-primary">
                            {step.type}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-text-muted">
                          {step.dependsOn?.length ?? 0} deps · {issueCount} issue{issueCount === 1 ? '' : 's'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  Selected Step
                </div>
                <Select
                  value={selectedStepId ?? ''}
                  onChange={(event) => selectStep(event.target.value)}
                  options={steps.map((step, index) => ({
                    value: step.id,
                    label: `${index + 1}. ${step.name || step.id}`,
                  }))}
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedIndex > 0) {
                        selectStep(steps[selectedIndex - 1]?.id ?? null);
                      }
                    }}
                    disabled={selectedIndex <= 0}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedIndex >= 0 && selectedIndex < steps.length - 1) {
                        selectStep(steps[selectedIndex + 1]?.id ?? null);
                      }
                    }}
                    disabled={selectedIndex < 0 || selectedIndex >= steps.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-cyber border border-accent-primary/15 bg-panel/50 p-4">
            {!selectedStep ? (
              <div className="px-4 py-10 text-sm text-text-secondary">
                Select a step to edit its details.
              </div>
            ) : (() => {
              const index = selectedIndex;
              const step = selectedStep;
              const updateStep = (patch: Partial<WorkflowStepRecord>) => {
                updateAtIndex(index, { ...step, ...patch });
              };
              const availableDependencies = steps.filter((candidate) => candidate.id !== step.id);
              const currentDependencies = step.dependsOn ?? [];
              const stepIssues = issuesByStepId[step.id] ?? [];

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Editing Step {index + 1}: {step.name || step.id}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {step.id} · {step.type}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveStep(index, -1)}>
                        Move Up
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveStep(index, 1)}>
                        Move Down
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => removeAtIndex(index)}>
                        Remove
                      </Button>
                    </div>
                  </div>

                  {stepIssues.length > 0 ? (
                    <div className="rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
                      {stepIssues.map((issue, issueIndex) => (
                        <div key={`${step.id}-issue-${issueIndex}`}>{issue}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <Input
                        label="Name"
                        value={step.name}
                        onChange={(event) => updateStep({ name: event.target.value })}
                        placeholder="Draft requirements"
                      />
                    </div>
                    <Select
                      label="Step Type"
                      value={step.type}
                      onChange={(event) => updateAtIndex(index, normalizeStepType(step, event.target.value as WorkflowStepType))}
                      options={stepTypeOptions}
                    />
                    <div className="md:col-span-2">
                      <Input
                        label="Description"
                        value={step.description ?? ''}
                        onChange={(event) => updateStep({ description: event.target.value })}
                        placeholder="Explain the purpose of this step for operators and reviewers."
                      />
                    </div>
                  </div>

                  <div>
                    {renderTypeSpecificFields(step, updateStep, agents, availableTags, workflows, steps, currentWorkflowId)}
                  </div>

                  {availableDependencies.length > 0 ? (
                    <div className="rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        Quick Dependency Picker
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableDependencies.map((candidate) => {
                          const isSelected = currentDependencies.includes(candidate.id);
                          return (
                            <Button
                              key={candidate.id}
                              type="button"
                              variant={isSelected ? 'primary' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                const nextDependencies = isSelected
                                  ? currentDependencies.filter((dependency) => dependency !== candidate.id)
                                  : [...currentDependencies, candidate.id];
                                updateStep({ dependsOn: nextDependencies.length > 0 ? nextDependencies : undefined });
                              }}
                            >
                              {candidate.id}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowStepEditor;
