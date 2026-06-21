import { describe, it, expect } from "vitest";
import { SQLiteRepository } from "../sqlite-repository.js";

interface TestEntity {
  id: string;
  value: number;
}

describe("SQLiteRepository", () => {
  it("saves and retrieves an item", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    await repo.save({ id: "a", value: 1 });
    const item = await repo.get("a");
    expect(item).toEqual({ id: "a", value: 1 });
    repo.close();
  });

  it("updates an existing item", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    await repo.save({ id: "a", value: 1 });
    await repo.save({ id: "a", value: 2 });
    const item = await repo.get("a");
    expect(item?.value).toBe(2);
    repo.close();
  });

  it("returns undefined for missing items", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    const item = await repo.get("missing");
    expect(item).toBeUndefined();
    repo.close();
  });

  it("lists all items", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    await repo.save({ id: "a", value: 1 });
    await repo.save({ id: "b", value: 2 });
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((i) => i.id).sort()).toEqual(["a", "b"]);
    repo.close();
  });

  it("deletes an item", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    await repo.save({ id: "a", value: 1 });
    await repo.delete("a");
    const item = await repo.get("a");
    expect(item).toBeUndefined();
    repo.close();
  });

  it("queries items with a predicate", async () => {
    const repo = new SQLiteRepository<TestEntity>(":memory:", "items");
    await repo.save({ id: "a", value: 1 });
    await repo.save({ id: "b", value: 2 });
    await repo.save({ id: "c", value: 3 });
    const found = await repo.query((i) => i.value > 1);
    expect(found).toHaveLength(2);
    expect(found.map((i) => i.id).sort()).toEqual(["b", "c"]);
    repo.close();
  });
});
