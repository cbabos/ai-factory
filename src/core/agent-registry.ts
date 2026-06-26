import type { AgentManifest, CapabilityTag, RankedAgentCandidate } from "./types.js";
import type { IAgentRegistry, IEventBus } from "./interfaces.js";

export class AgentRegistry implements IAgentRegistry {
  private agents = new Map<string, AgentManifest>();
  public eventBus: IEventBus;

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

  rankByTags(tags: string[]): RankedAgentCandidate[] {
    const normalizedTaskTags = this.unique(tags);
    const candidates: RankedAgentCandidate[] = [];

    for (const manifest of this.agents.values()) {
      const agentTags = this.unique(manifest.tags);
      const matchedTaskTags = normalizedTaskTags.filter((tag) => agentTags.includes(tag));
      const missingTaskTags = normalizedTaskTags.filter((tag) => !agentTags.includes(tag));
      const extraAgentTags = agentTags.filter((tag) => !matchedTaskTags.includes(tag));

      if (!this.meetsMinimumAcceptance(normalizedTaskTags, matchedTaskTags)) {
        continue;
      }

      const score = this.calculateScore({
        matchedCount: matchedTaskTags.length,
        missingCount: missingTaskTags.length,
        extraCount: extraAgentTags.length,
      });

      candidates.push({
        manifest,
        matchedTaskTags,
        missingTaskTags,
        extraAgentTags,
        score,
      });
    }

    return candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.missingTaskTags.length !== right.missingTaskTags.length) {
        return left.missingTaskTags.length - right.missingTaskTags.length;
      }
      if (left.extraAgentTags.length !== right.extraAgentTags.length) {
        return left.extraAgentTags.length - right.extraAgentTags.length;
      }
      return left.manifest.id.localeCompare(right.manifest.id);
    });
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

  private calculateScore(counts: { matchedCount: number; missingCount: number; extraCount: number }): number {
    return (counts.matchedCount * 100) - (counts.missingCount * 35) - (counts.extraCount * 5);
  }

  private meetsMinimumAcceptance(taskTags: CapabilityTag[], matchedTaskTags: CapabilityTag[]): boolean {
    if (taskTags.length === 0) {
      return true;
    }

    if (matchedTaskTags.length === 0) {
      return false;
    }

    return matchedTaskTags.length * 2 >= taskTags.length;
  }

  private unique(tags: CapabilityTag[]): CapabilityTag[] {
    return tags.filter((tag, index) => tags.indexOf(tag) === index);
  }
}
