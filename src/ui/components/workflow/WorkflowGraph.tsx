import { useMemo, useState } from 'react';
import type { WorkflowDefinitionRecord, WorkflowStepRecord } from '../../services/index.js';
import type { WorkflowValidationIssue } from './workflow-validation.js';

interface WorkflowGraphProps {
  steps: WorkflowStepRecord[];
  workflows?: WorkflowDefinitionRecord[];
  issues?: WorkflowValidationIssue[];
  onToggleDependency?: (dependentStepId: string, dependencyStepId: string) => void;
  layoutPositions?: Record<string, { x: number; y: number }>;
  onUpdateNodePosition?: (stepId: string, position: { x: number; y: number }) => void;
  onResetNodePosition?: (stepId: string) => void;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}

interface PositionedStep {
  step: WorkflowStepRecord;
  column: number;
  row: number;
  x: number;
  y: number;
}

interface PositionedEdge {
  from: PositionedStep;
  to: PositionedStep;
  dependencyId: string;
  dependentId: string;
}

interface ConnectionDraft {
  sourceStepId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface NodeDragDraft {
  stepId: string;
  offsetX: number;
  offsetY: number;
}

const NODE_WIDTH = 260;
const NODE_HEIGHT = 160;
const COLUMN_GAP = 88;
const ROW_GAP = 48;
const PADDING = 24;
const HEADER_HEIGHT = 44;

function summarizeStep(step: WorkflowStepRecord): string {
  switch (step.type) {
    case 'agent':
      return step.agentId
        ? `Agent ${step.agentId}`
        : 'Deterministic agent execution';
    case 'human-input':
      return step.outputKey
        ? `Collects input into ${step.outputKey}`
        : 'Collects human clarification';
    case 'human-approval':
      return step.outputKey
        ? `Approval gate writes ${step.outputKey}`
        : 'Approval gate';
    case 'subworkflow':
      return step.workflow?.workflowId
        ? `Calls ${step.workflow.workflowId} v${step.workflow.workflowVersion ?? 'latest'}`
        : 'Calls nested workflow';
    default:
      return 'Workflow step';
  }
}

function workflowNameForStep(
  step: WorkflowStepRecord,
  workflows: WorkflowDefinitionRecord[],
): string | null {
  if (step.type !== 'subworkflow' || !step.workflow?.workflowId) {
    return null;
  }

  const target = workflows.find((workflow) =>
    workflow.id === step.workflow?.workflowId
    && (step.workflow?.workflowVersion ? workflow.version === step.workflow.workflowVersion : true),
  );

  return target ? `${target.name} (${target.id} v${target.version})` : null;
}

function buildIssuesByStepId(issues: WorkflowValidationIssue[]): Map<string, WorkflowValidationIssue[]> {
  const result = new Map<string, WorkflowValidationIssue[]>();

  for (const issue of issues) {
    const current = result.get(issue.stepId) ?? [];
    result.set(issue.stepId, [...current, issue]);
  }

  return result;
}

function buildDependentsByStepId(steps: WorkflowStepRecord[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const step of steps) {
    for (const dependency of step.dependsOn ?? []) {
      const current = result.get(dependency) ?? [];
      result.set(dependency, [...current, step.id]);
    }
  }

  return result;
}

function computeOrderWeights(
  steps: WorkflowStepRecord[],
  depths: Map<string, number>,
  dependentsByStepId: Map<string, string[]>,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const step of steps) {
    const dependencies = (step.dependsOn ?? [])
      .map((dependencyId) => depths.get(dependencyId))
      .filter((value): value is number => value !== undefined);
    const dependents = (dependentsByStepId.get(step.id) ?? [])
      .map((dependentId) => depths.get(dependentId))
      .filter((value): value is number => value !== undefined);

    const upstreamCenter = dependencies.length > 0
      ? dependencies.reduce((sum, value) => sum + value, 0) / dependencies.length
      : 0;
    const downstreamPull = dependents.length > 0
      ? dependents.reduce((sum, value) => sum + value, 0) / dependents.length
      : upstreamCenter;

    result.set(step.id, upstreamCenter + downstreamPull / 10);
  }

  return result;
}

function computeDepths(steps: WorkflowStepRecord[]): Map<string, number> {
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveDepth = (stepId: string): number => {
    const cached = depths.get(stepId);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(stepId)) {
      return 0;
    }

    visiting.add(stepId);
    const step = stepMap.get(stepId);
    const dependencies = step?.dependsOn ?? [];
    const validDependencies = dependencies.filter((dependency) => stepMap.has(dependency));
    const depth = validDependencies.length === 0
      ? 0
      : Math.max(...validDependencies.map((dependency) => resolveDepth(dependency))) + 1;
    visiting.delete(stepId);
    depths.set(stepId, depth);
    return depth;
  };

  for (const step of steps) {
    resolveDepth(step.id);
  }

  return depths;
}

function positionSteps(steps: WorkflowStepRecord[]): {
  positionedSteps: PositionedStep[];
  columnDepths: number[];
  width: number;
  height: number;
} {
  const depths = computeDepths(steps);
  const columns = new Map<number, WorkflowStepRecord[]>();
  const dependentsByStepId = buildDependentsByStepId(steps);
  const orderWeights = computeOrderWeights(steps, depths, dependentsByStepId);

  for (const step of steps) {
    const depth = depths.get(step.id) ?? 0;
    const current = columns.get(depth) ?? [];
    columns.set(depth, [...current, step]);
  }

  const sortedColumns = [...columns.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([depth, columnSteps]) => [
      depth,
      [...columnSteps].sort((left, right) =>
        (orderWeights.get(left.id) ?? 0) - (orderWeights.get(right.id) ?? 0)
        || (left.dependsOn?.length ?? 0) - (right.dependsOn?.length ?? 0)
        || left.name.localeCompare(right.name)
        || left.id.localeCompare(right.id)),
    ] as const);

  const positionedSteps: PositionedStep[] = [];
  let maxRows = 1;

  for (const [columnIndex, [, columnSteps]] of sortedColumns.entries()) {
    maxRows = Math.max(maxRows, columnSteps.length);
    columnSteps.forEach((step, rowIndex) => {
      positionedSteps.push({
        step,
        column: columnIndex,
        row: rowIndex,
        x: PADDING + columnIndex * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + HEADER_HEIGHT + rowIndex * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }

  const columnCount = Math.max(sortedColumns.length, 1);
  const width = PADDING * 2 + columnCount * NODE_WIDTH + Math.max(columnCount - 1, 0) * COLUMN_GAP;
  const height = PADDING * 2 + HEADER_HEIGHT + maxRows * 2 * NODE_HEIGHT + Math.max(maxRows - 1, 0) * ROW_GAP;

  return {
    positionedSteps,
    columnDepths: sortedColumns.map(([depth]) => depth),
    width,
    height,
  };
}

export function computeWorkflowGraphAutoLayout(
  steps: WorkflowStepRecord[],
): Record<string, { x: number; y: number }> {
  const { positionedSteps } = positionSteps(steps);
  return Object.fromEntries(
    positionedSteps.map((positioned) => [
      positioned.step.id,
      { x: positioned.x, y: positioned.y },
    ]),
  );
}

function applyLayoutPositions(
  positionedSteps: PositionedStep[],
  layoutPositions: Record<string, { x: number; y: number }>,
): PositionedStep[] {
  return positionedSteps.map((positioned) => {
    const override = layoutPositions[positioned.step.id];
    if (!override) {
      return positioned;
    }
    return {
      ...positioned,
      x: override.x,
      y: override.y,
    };
  });
}

function edgePath(from: PositionedStep, to: PositionedStep): string {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const horizontalControl = deltaX >= 0
    ? Math.max(deltaX / 2, 48)
    : Math.max(Math.abs(deltaX) / 2, 72);
  const verticalTension = Math.min(Math.abs(deltaY) / 3, 64);

  return `M ${startX} ${startY} C ${startX + horizontalControl} ${startY + verticalTension}, ${endX - horizontalControl} ${endY - verticalTension}, ${endX} ${endY}`;
}

function previewEdgePath(draft: ConnectionDraft): string {
  const controlOffset = Math.max((draft.currentX - draft.startX) / 2, 48);
  return `M ${draft.startX} ${draft.startY} C ${draft.startX + controlOffset} ${draft.startY}, ${draft.currentX - controlOffset} ${draft.currentY}, ${draft.currentX} ${draft.currentY}`;
}

function edgeMidpoint(from: PositionedStep, to: PositionedStep): { x: number; y: number } {
  return {
    x: (from.x + NODE_WIDTH + to.x) / 2,
    y: (from.y + NODE_HEIGHT / 2 + to.y + NODE_HEIGHT / 2) / 2,
  };
}

export function WorkflowGraph({
  steps,
  workflows = [],
  issues = [],
  onToggleDependency,
  layoutPositions = {},
  onUpdateNodePosition,
  onResetNodePosition,
  selectedStepId: selectedStepIdProp,
  onSelectStep,
}: WorkflowGraphProps) {
  const [internalSelectedStepId, setInternalSelectedStepId] = useState<string | null>(selectedStepIdProp ?? null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [nodeDragDraft, setNodeDragDraft] = useState<NodeDragDraft | null>(null);

  const selectedStepId = selectedStepIdProp ?? internalSelectedStepId;

  const issuesByStepId = useMemo(() => buildIssuesByStepId(issues), [issues]);
  const dependentsByStepId = useMemo(() => buildDependentsByStepId(steps), [steps]);
  const baseLayout = useMemo(() => positionSteps(steps), [steps]);
  const positionedSteps = useMemo(
    () => applyLayoutPositions(baseLayout.positionedSteps, layoutPositions),
    [baseLayout.positionedSteps, layoutPositions],
  );
  const { columnDepths, width, height } = baseLayout;
  const positionedById = useMemo(() => {
    return new Map(positionedSteps.map((positioned) => [positioned.step.id, positioned]));
  }, [positionedSteps]);
  const positionedEdges = useMemo<PositionedEdge[]>(() => {
    return steps.flatMap((step) => {
      const to = positionedById.get(step.id);
      if (!to) {
        return [];
      }

      return (step.dependsOn ?? []).flatMap((dependencyId) => {
        const from = positionedById.get(dependencyId);
        if (!from) {
          return [];
        }

        return [{
          from,
          to,
          dependencyId,
          dependentId: step.id,
        }];
      });
    });
  }, [positionedById, steps]);

  if (steps.length === 0) {
    return (
      <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-panel/50 px-4 py-8 text-sm text-text-secondary">
        No steps yet. Add steps in the editor to preview the workflow graph.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onToggleDependency ? (
        <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/20 px-3 py-2 text-xs text-text-secondary">
          Click a node to focus its step details. Use "Drag to connect" for dependencies.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-cyber border border-accent-primary/15 bg-panel/40 p-3">
        <div
          className="relative"
          style={{ width, height }}
          onMouseMove={(event) => {
            if (nodeDragDraft && onUpdateNodePosition) {
              onUpdateNodePosition(nodeDragDraft.stepId, {
                x: event.nativeEvent.offsetX - nodeDragDraft.offsetX,
                y: event.nativeEvent.offsetY - nodeDragDraft.offsetY,
              });
            }
            setConnectionDraft((current) => current
              ? {
                  ...current,
                  currentX: event.nativeEvent.offsetX,
                  currentY: event.nativeEvent.offsetY,
                }
              : null);
          }}
          onMouseUp={() => {
            setConnectionDraft(null);
            setHoveredTargetId(null);
            setNodeDragDraft(null);
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="workflow-graph-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(0,243,255,0.7)" />
              </marker>
            </defs>

            {positionedEdges.map(({ from, to, dependencyId, dependentId }) => {
              const highlighted = selectedStepId === dependentId || selectedStepId === dependencyId;

              return (
                <path
                  key={`${dependencyId}->${dependentId}`}
                  d={edgePath(from, to)}
                  fill="none"
                  stroke={highlighted ? 'rgba(255,0,255,0.8)' : 'rgba(0,243,255,0.55)'}
                  strokeWidth={highlighted ? 3 : 2}
                  markerEnd="url(#workflow-graph-arrow)"
                />
              );
            })}

            {connectionDraft ? (
              <path
                d={previewEdgePath(connectionDraft)}
                fill="none"
                stroke="rgba(255,0,255,0.8)"
                strokeWidth={3}
                strokeDasharray="8 6"
                markerEnd="url(#workflow-graph-arrow)"
              />
            ) : null}
          </svg>

          {columnDepths.map((depth, columnIndex) => (
            <div
              key={`lane-${depth}`}
              className="absolute rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 px-3 py-2 text-center text-xs uppercase tracking-[0.16em] text-text-secondary"
              style={{
                left: PADDING + columnIndex * (NODE_WIDTH + COLUMN_GAP),
                top: PADDING,
                width: NODE_WIDTH,
              }}
            >
              Lane {columnIndex + 1}
              <div className="mt-1 text-[10px] normal-case tracking-normal text-text-muted">
                dependency depth {depth}
              </div>
            </div>
          ))}

          {positionedEdges.map(({ from, to, dependencyId, dependentId }) => {
            const midpoint = edgeMidpoint(from, to);
            const highlighted = selectedStepId === dependentId || selectedStepId === dependencyId;

            return (
              <div
                key={`label-${dependencyId}->${dependentId}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                  highlighted
                    ? 'border-accent-secondary/40 bg-accent-secondary/15 text-accent-secondary'
                    : 'border-accent-primary/20 bg-panel/90 text-text-secondary'
                }`}
                style={{ left: midpoint.x, top: midpoint.y }}
              >
                {dependencyId} {'->'} {dependentId}
              </div>
            );
          })}

          {positionedSteps.map((positioned) => {
            const { step, x, y, column } = positioned;
            const nestedWorkflowName = workflowNameForStep(step, workflows);
            const stepIssues = issuesByStepId.get(step.id) ?? [];
            const hasErrors = stepIssues.some((issue) => issue.severity === 'error');
            const isSelectedDependent = selectedStepId === step.id;
            const isConnectionTarget = hoveredTargetId === step.id;
            const hasCustomPosition = layoutPositions[step.id] !== undefined;

            return (
              <div
                key={step.id}
                role={onToggleDependency ? 'button' : undefined}
                tabIndex={onToggleDependency ? 0 : undefined}
                className={`absolute rounded-cyber border bg-panel/80 px-4 py-4 text-left shadow-[0_0_18px_rgba(0,0,0,0.35)] transition-all ${
                  isSelectedDependent
                    ? 'border-accent-secondary ring-2 ring-accent-secondary/35'
                    : isConnectionTarget
                      ? 'border-accent-secondary/70 ring-2 ring-accent-secondary/25'
                    : hasErrors
                      ? 'border-accent-danger/35'
                      : 'border-accent-primary/15 hover:border-accent-primary/35'
                }`}
                style={{ left: x, top: y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                onClick={() => {
                  setInternalSelectedStepId(step.id);
                  onSelectStep?.(step.id);
                }}
                onKeyDown={(event) => {
                  if ((event.key !== 'Enter' && event.key !== ' ')) {
                    return;
                  }
                  event.preventDefault();
                  setInternalSelectedStepId(step.id);
                  onSelectStep?.(step.id);
                }}
                onMouseEnter={() => {
                  if (connectionDraft && connectionDraft.sourceStepId !== step.id) {
                    setHoveredTargetId(step.id);
                  }
                }}
                onMouseLeave={() => {
                  if (hoveredTargetId === step.id) {
                    setHoveredTargetId(null);
                  }
                }}
                onMouseUp={() => {
                  if (
                    connectionDraft
                    && onToggleDependency
                    && connectionDraft.sourceStepId !== step.id
                  ) {
                    onToggleDependency(step.id, connectionDraft.sourceStepId);
                  }
                  setConnectionDraft(null);
                  setHoveredTargetId(null);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text-primary">{step.name || 'Untitled Step'}</div>
                    <div className="text-xs text-text-secondary">
                      {step.id} · lane {column + 1}
                    </div>
                  </div>
                  <span className="rounded-full border border-accent-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                    {step.type}
                  </span>
                </div>

                {step.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{step.description}</p>
                ) : null}

                <div className="mt-3 rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 px-3 py-2 text-sm text-text-primary">
                  {summarizeStep(step)}
                </div>

                {step.type === 'subworkflow' && nestedWorkflowName ? (
                  <div className="mt-2 text-xs text-accent-secondary">
                    Nested workflow: {nestedWorkflowName}
                  </div>
                ) : null}

                {stepIssues.length > 0 ? (
                  <div className="mt-3 rounded-cyber border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger">
                    {stepIssues.map((issue, issueIndex) => (
                      <div key={`${step.id}-graph-issue-${issueIndex}`}>{issue.message}</div>
                    ))}
                  </div>
                ) : null}

                {step.dependsOn && step.dependsOn.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Depends on</span>
                    {step.dependsOn.map((dependency) => (
                      <span
                        key={dependency}
                        className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] text-accent-secondary"
                      >
                        {dependency}
                      </span>
                    ))}
                  </div>
                ) : null}

                {(dependentsByStepId.get(step.id)?.length ?? 0) > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Feeds into</span>
                    {(dependentsByStepId.get(step.id) ?? []).map((dependent) => (
                      <span
                        key={dependent}
                        className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-accent-primary"
                      >
                        {dependent}
                      </span>
                    ))}
                  </div>
                ) : null}

                {onToggleDependency ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                      {isSelectedDependent ? 'Selected step' : 'Click to select'}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="rounded-full border border-accent-secondary/30 bg-accent-secondary/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-accent-secondary"
                      onMouseDown={(event) => {
                        if (!onToggleDependency) {
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        setHoveredTargetId(null);
                        setConnectionDraft({
                          sourceStepId: step.id,
                          startX: x + NODE_WIDTH,
                          startY: y + NODE_HEIGHT / 2,
                          currentX: x + NODE_WIDTH,
                          currentY: y + NODE_HEIGHT / 2,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (!onToggleDependency || (event.key !== 'Enter' && event.key !== ' ')) {
                          return;
                        }
                        event.preventDefault();
                        setHoveredTargetId(null);
                        setConnectionDraft({
                          sourceStepId: step.id,
                          startX: x + NODE_WIDTH,
                          startY: y + NODE_HEIGHT / 2,
                          currentX: x + NODE_WIDTH,
                          currentY: y + NODE_HEIGHT / 2,
                        });
                      }}
                    >
                      Drag to connect
                    </div>
                    {onUpdateNodePosition ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-accent-primary"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setConnectionDraft(null);
                          setHoveredTargetId(null);
                          setNodeDragDraft({
                            stepId: step.id,
                            offsetX: event.nativeEvent.offsetX - x,
                            offsetY: event.nativeEvent.offsetY - y,
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                          }
                          event.preventDefault();
                        }}
                      >
                        Drag node
                      </div>
                    ) : null}
                    {onResetNodePosition && hasCustomPosition ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className="rounded-full border border-accent-warning/30 bg-accent-warning/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-accent-warning"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onResetNodePosition(step.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          onResetNodePosition(step.id);
                        }}
                      >
                        Reset node
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WorkflowGraph;
