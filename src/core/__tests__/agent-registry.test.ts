import { describe, it, expect, vi } from "vitest";
import { AgentRegistry } from "../agent-registry.js";
import { EventBus } from "../event-bus.js";
import type { AgentManifest } from "../types.js";

function makeManifest(id: string, tags: string[], complexityRange: [number, number]): AgentManifest {
  return {
    id,
    tags,
    complexityRange,
    tokenProfile: { min: 100, max: 1000, typical: 500 },
    preferredModels: ["gpt-4o-mini"],
    timeoutMs: 30000,
    maxRetries: 2,
  };
}

describe("AgentRegistry", () => {
  it("registers an agent and emits event", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("agent:registered", handler);
    const registry = new AgentRegistry(bus);
    const manifest = makeManifest("a1", ["search"], [1, 4]);
    registry.register(manifest);
    expect(registry.get("a1")).toEqual(manifest);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("unregisters an agent and emits event", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("agent:unregistered", handler);
    const registry = new AgentRegistry(bus);
    registry.register(makeManifest("a1", ["search"], [1, 4]));
    registry.unregister("a1");
    expect(registry.get("a1")).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("finds agents by tags", () => {
    const registry = new AgentRegistry(new EventBus());
    registry.register(makeManifest("a1", ["search", "read-only"], [1, 4]));
    registry.register(makeManifest("a2", ["search"], [1, 4]));
    registry.register(makeManifest("a3", ["analysis"], [3, 7]));
    expect(registry.findByTags(["search"]).map((m) => m.id).sort()).toEqual(["a1", "a2"]);
    expect(registry.findByTags(["search", "read-only"]).map((m) => m.id)).toEqual(["a1"]);
    expect(registry.findByTags(["missing"])).toEqual([]);
  });

  it("finds agents by complexity", () => {
    const registry = new AgentRegistry(new EventBus());
    registry.register(makeManifest("a1", ["search"], [1, 4]));
    registry.register(makeManifest("a2", ["analysis"], [3, 7]));
    expect(registry.findByComplexity(2).map((m) => m.id)).toEqual(["a1"]);
    expect(registry.findByComplexity(5).map((m) => m.id)).toEqual(["a2"]);
    expect(registry.findByComplexity(8)).toEqual([]);
  });

  it("returns all registered agents", () => {
    const registry = new AgentRegistry(new EventBus());
    registry.register(makeManifest("a1", ["search"], [1, 4]));
    registry.register(makeManifest("a2", ["analysis"], [3, 7]));
    expect(registry.getAll()).toHaveLength(2);
  });
});
