import type { WorkflowDefinition } from "./workflow-types.js";
import type { IWorkflowRepository } from "./workflow-repository.js";

function now(): number {
  return Date.now();
}

export function getStarterWorkflows(): WorkflowDefinition[] {
  const createdAt = now();

  return [
    {
      id: "requirements-clarify-and-approve",
      name: "Requirements Clarify and Approve",
      version: 1,
      status: "archived",
      description: "Draft requirements, ask for missing details, then require human approval before completion.",
      createdAt,
      updatedAt: createdAt,
      metadata: {
        category: "planning",
        seeded: true,
      },
      steps: [
        {
          id: "draft-requirements",
          name: "Draft Requirements",
          type: "agent",
          agentId: "analysis-agent",
          instruction:
            "Draft an initial requirements document for {{task.description}} using {{task.context}}. Highlight assumptions and open questions clearly.",
          outputKey: "draftRequirements",
          capabilityTags: ["analysis", "reasoning"],
        },
        {
          id: "clarify-with-human",
          name: "Clarify Missing Details",
          type: "human-input",
          prompt:
            "Review the draft requirements and answer any missing details needed to proceed for {{task.description}}. Current workflow context: {{workflow.context}}",
          outputKey: "clarifications",
          dependsOn: ["draft-requirements"],
        },
        {
          id: "finalize-requirements",
          name: "Finalize Requirements",
          type: "agent",
          agentId: "summarizer-agent",
          instruction:
            "Using the draft requirements, human clarifications, and any approval feedback in {{workflow.context}}, produce a final concise requirements summary for {{task.description}}.",
          outputKey: "finalRequirements",
          capabilityTags: ["summarization", "synthesis"],
          dependsOn: ["clarify-with-human"],
        },
        {
          id: "approve-requirements",
          name: "Approve Requirements",
          type: "human-approval",
          prompt:
            "Approve or reject the finalized requirements for {{task.description}}. Current workflow context: {{workflow.context}}",
          outputKey: "approvalDecision",
          onChangesRequested: "finalize-requirements",
          onRejected: "fail",
          dependsOn: ["finalize-requirements"],
        },
      ],
    },
    {
      id: "requirements-clarify-and-approve",
      name: "Requirements Clarify and Approve",
      version: 2,
      status: "active",
      description: "Draft requirements into a reusable document, collect structured clarifications, then require human approval before completion.",
      createdAt,
      updatedAt: createdAt,
      metadata: {
        category: "planning",
        seeded: true,
      },
      steps: [
        {
          id: "draft-requirements",
          name: "Draft Requirements",
          type: "agent",
          agentId: "analysis-agent",
          instruction:
            [
              "Draft an initial requirements document for {{task.description}} using {{task.context}}.",
              "Return valid JSON only with this shape:",
              "{",
              '  "document": { "title": "Business Requirements Document", "format": "markdown", "content": "<full markdown document>" },',
              '  "summary": "<short summary>",',
              '  "openQuestions": [',
              '    { "id": "short-id", "question": "<question for human>", "rationale": "<why this matters>" }',
              "  ]",
              "}",
              "The markdown document must capture assumptions, proposed requirements, and clearly separated open questions.",
              "Only include openQuestions that require human clarification before the next drafting pass.",
            ].join("\n"),
          outputKey: "draftRequirements",
          capabilityTags: ["analysis", "reasoning"],
        },
        {
          id: "clarify-with-human",
          name: "Clarify Missing Details",
          type: "human-input",
          prompt:
            "Review the drafted requirements and answer the outstanding questions needed to proceed for {{task.description}}. Current workflow context: {{workflow.context}}",
          promptMode: "questionnaire",
          outputKey: "clarifications",
          dependsOn: ["draft-requirements"],
        },
        {
          id: "finalize-requirements",
          name: "Finalize Requirements",
          type: "agent",
          agentId: "summarizer-agent",
          instruction:
            [
              "Using the drafted requirements document, structured human clarifications, and any approval feedback in {{workflow.context}}, produce the finalized requirements package for {{task.description}}.",
              "Return valid JSON only with this shape:",
              "{",
              '  "document": { "title": "Final Requirements Document", "format": "markdown", "content": "<full finalized markdown document>" },',
              '  "summary": "<concise summary of the final requirements>",',
              '  "remainingOpenQuestions": ["<optional unresolved question>"]',
              "}",
              "The final markdown document should incorporate the human answers and call out anything still unresolved.",
            ].join("\n"),
          outputKey: "finalRequirements",
          capabilityTags: ["summarization", "synthesis"],
          dependsOn: ["clarify-with-human"],
        },
        {
          id: "approve-requirements",
          name: "Approve Requirements",
          type: "human-approval",
          prompt:
            "Approve or reject the finalized requirements package for {{task.description}}. Review the generated artifacts alongside this workflow context: {{workflow.context}}",
          outputKey: "approvalDecision",
          onChangesRequested: "finalize-requirements",
          onRejected: "fail",
          dependsOn: ["finalize-requirements"],
        },
      ],
    },
    {
      id: "implement-test-review",
      name: "Implement Test Review",
      version: 1,
      status: "active",
      description: "Implement a task, summarize the change, and require human review before final acceptance.",
      createdAt,
      updatedAt: createdAt,
      metadata: {
        category: "delivery",
        seeded: true,
      },
      steps: [
        {
          id: "implement-change",
          name: "Implement Change",
          type: "agent",
          agentId: "executor-agent",
          instruction:
            "Implement the requested change for {{task.description}} using {{task.context}} and any prior workflow feedback in {{workflow.context}}. Be explicit about any files or outputs you would modify.",
          outputKey: "implementation",
          capabilityTags: ["execution", "code-generation", "write"],
        },
        {
          id: "summarize-change",
          name: "Summarize Change",
          type: "agent",
          agentId: "summarizer-agent",
          instruction:
            "Summarize the implementation results for {{task.description}} using {{workflow.context}}. Include what changed, what remains uncertain, and any follow-up verification needed.",
          outputKey: "changeSummary",
          capabilityTags: ["summarization", "synthesis"],
          dependsOn: ["implement-change"],
        },
        {
          id: "human-review",
          name: "Human Review",
          type: "human-approval",
          prompt:
            "Review the implementation summary for {{task.description}} and approve, reject, or request changes. Current workflow context: {{workflow.context}}",
          outputKey: "reviewDecision",
          onChangesRequested: "implement-change",
          onRejected: "fail",
          dependsOn: ["summarize-change"],
        },
      ],
    },
  ];
}

export async function seedStarterWorkflows(repository: IWorkflowRepository): Promise<void> {
  const starterWorkflows = getStarterWorkflows();
  for (const workflow of starterWorkflows) {
    const existing = await repository.get(workflow.id, workflow.version);
    if (!existing) {
      await repository.save(workflow);
    }
  }
}
