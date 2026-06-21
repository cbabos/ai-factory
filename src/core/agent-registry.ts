import type { AgentManifest } from "./types.js";
import type { IAgentRegistry, IEventBus } from "./interfaces.js";

export class AgentRegistry implements IAgentRegistry {
  private agents = new Map<string, AgentManifest>();
  private eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  register(manifest: AgentManifest): void {
    this.agents.set(manifest.id, manifest);
    this.eventBus.emit({
      type: "agent:registered",
      timestamp: Date.now(),
      payload: { agentId: manifest.id, tags: manifest.tags },
      traceId: "registry",
    });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
    this.eventBus.emit({
      type: "agent:unregistered",
      timestamp: Date.now(),
      payload: { agentId },
      traceId: "registry",
    });
  }

  get(agentId: string): AgentManifest | undefined {
    return this.agents.get(agentId);
  }

  findByTags(tags: string[]): AgentManifest[] {
    const results: AgentManifest[] = [];
    for (const agent of this.agents.values()) {
      if (tags.every((t) => agent.tags.includes(t))) {
        results.push(agent);
      }
    }
    return results;
  }

  findByComplexity(score: number): AgentManifest[] {
    const results: AgentManifest[] = [];
    for (const agent of this.agents.values()) {
      const [min, max] = agent.complexityRange;
      if (score >= min && score <= max) {
        results.push(agent);
      }
    }
    return results;
  }

  getAll(): AgentManifest[] {
    return Array.from(this.agents.values());
  }
}
