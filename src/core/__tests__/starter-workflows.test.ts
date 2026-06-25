import { describe, it, expect } from "vitest";
import { getStarterWorkflows, seedStarterWorkflows } from "../starter-workflows.js";
import { InMemoryWorkflowRepository } from "../workflow-repository.js";

describe("starter workflows", () => {
  it("provides reusable deterministic starter workflows", () => {
    const workflows = getStarterWorkflows();
    expect(workflows.map((workflow) => `${workflow.id}@${workflow.version}`)).toEqual([
      "requirements-clarify-and-approve@1",
      "requirements-clarify-and-approve@2",
      "implement-test-review@1",
    ]);
    expect(workflows.every((workflow) => workflow.steps.length > 0)).toBe(true);
  });

  it("seeds starter workflows without duplicating existing versions", async () => {
    const repository = new InMemoryWorkflowRepository();
    await seedStarterWorkflows(repository);
    await seedStarterWorkflows(repository);
    const workflows = await repository.getAll();
    expect(workflows).toHaveLength(3);
  });
});
