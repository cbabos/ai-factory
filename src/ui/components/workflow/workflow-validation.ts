import type { WorkflowStepRecord } from '../../services/index.js';

export interface WorkflowValidationIssue {
  stepId: string;
  severity: 'error' | 'warning';
  message: string;
}

function buildStepMap(steps: WorkflowStepRecord[]): Map<string, WorkflowStepRecord> {
  return new Map(steps.map((step) => [step.id, step]));
}

function detectCycles(steps: WorkflowStepRecord[]): Set<string> {
  const stepMap = buildStepMap(steps);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleMembers = new Set<string>();

  const visit = (stepId: string, path: string[]) => {
    if (visiting.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      for (const member of path.slice(cycleStart)) {
        cycleMembers.add(member);
      }
      cycleMembers.add(stepId);
      return;
    }

    if (visited.has(stepId)) {
      return;
    }

    visited.add(stepId);
    visiting.add(stepId);

    const step = stepMap.get(stepId);
    for (const dependency of step?.dependsOn ?? []) {
      if (stepMap.has(dependency)) {
        visit(dependency, [...path, stepId]);
      }
    }

    visiting.delete(stepId);
  };

  for (const step of steps) {
    visit(step.id, []);
  }

  return cycleMembers;
}

export function validateWorkflowSteps(steps: WorkflowStepRecord[]): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const stepMap = buildStepMap(steps);
  const seenIds = new Set<string>();
  const cycleMembers = detectCycles(steps);

  for (const step of steps) {
    if (!step.id.trim()) {
      issues.push({
        stepId: step.id,
        severity: 'error',
        message: 'Step ID is required.',
      });
    }

    if (seenIds.has(step.id)) {
      issues.push({
        stepId: step.id,
        severity: 'error',
        message: 'Step ID must be unique.',
      });
    }
    seenIds.add(step.id);

    for (const dependency of step.dependsOn ?? []) {
      if (dependency === step.id) {
        issues.push({
          stepId: step.id,
          severity: 'error',
          message: 'A step cannot depend on itself.',
        });
      } else if (!stepMap.has(dependency)) {
        issues.push({
          stepId: step.id,
          severity: 'error',
          message: `Dependency "${dependency}" does not exist.`,
        });
      }
    }

    if (step.type === 'human-approval') {
      if (step.onChangesRequested) {
        if (step.onChangesRequested === step.id) {
          issues.push({
            stepId: step.id,
            severity: 'error',
            message: '"On Changes Requested" cannot point to the approval step itself.',
          });
        } else if (!stepMap.has(step.onChangesRequested)) {
          issues.push({
            stepId: step.id,
            severity: 'error',
            message: `Requested changes route "${step.onChangesRequested}" does not exist.`,
          });
        }
      }

      if (step.onRejected && step.onRejected !== 'fail') {
        if (step.onRejected === step.id) {
          issues.push({
            stepId: step.id,
            severity: 'error',
            message: '"On Rejected" cannot point to the approval step itself.',
          });
        } else if (!stepMap.has(step.onRejected)) {
          issues.push({
            stepId: step.id,
            severity: 'error',
            message: `Rejected route "${step.onRejected}" does not exist.`,
          });
        }
      }
    }

    if (cycleMembers.has(step.id)) {
      issues.push({
        stepId: step.id,
        severity: 'error',
        message: 'This step is part of a cyclic dependency.',
      });
    }

    if (!step.name.trim()) {
      issues.push({
        stepId: step.id,
        severity: 'warning',
        message: 'Step name is empty.',
      });
    }

    if (step.type === 'human-input' && step.promptMode === 'questionnaire' && (step.questions?.length ?? 0) === 0) {
      issues.push({
        stepId: step.id,
        severity: 'warning',
        message: 'Questionnaire mode is enabled, but no questions are defined yet.',
      });
    }
  }

  return issues;
}
