import { describe, it, expect } from "vitest";
import { InMemoryRepository } from "../repository.js";

interface Item {
  id: string;
  name: string;
  value: number;
}

describe("InMemoryRepository", () => {
  it("saves and retrieves an item", async () => {
    const repo = new InMemoryRepository<Item>();
    await repo.save({ id: "1", name: "a", value: 10 });
    const found = await repo.get("1");
    expect(found).toEqual({ id: "1", name: "a", value: 10 });
  });

  it("returns undefined for missing item", async () => {
    const repo = new InMemoryRepository<Item>();
    expect(await repo.get("missing")).toBeUndefined();
  });

  it("returns all saved items", async () => {
    const repo = new InMemoryRepository<Item>();
    await repo.save({ id: "1", name: "a", value: 1 });
    await repo.save({ id: "2", name: "b", value: 2 });
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it("deletes an item", async () => {
    const repo = new InMemoryRepository<Item>();
    await repo.save({ id: "1", name: "a", value: 10 });
    await repo.delete("1");
    expect(await repo.get("1")).toBeUndefined();
  });

  it("queries items by predicate", async () => {
    const repo = new InMemoryRepository<Item>();
    await repo.save({ id: "1", name: "a", value: 10 });
    await repo.save({ id: "2", name: "b", value: 20 });
    await repo.save({ id: "3", name: "c", value: 30 });
    const high = await repo.query((i) => i.value > 15);
    expect(high.map((i) => i.id).sort()).toEqual(["2", "3"]);
  });

  it("deep clones saved items", async () => {
    const repo = new InMemoryRepository<Item>();
    const item: Item = { id: "1", name: "a", value: 10 };
    await repo.save(item);
    item.value = 99;
    const found = await repo.get("1");
    expect(found?.value).toBe(10);
  });
});
