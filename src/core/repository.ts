import type { IRepository } from "./interfaces.js";

export class InMemoryRepository<T extends { id: string }> implements IRepository<T> {
  private store = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id);
  }

  async getAll(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async save(item: T): Promise<void> {
    this.store.set(item.id, structuredClone(item));
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async query(predicate: (item: T) => boolean): Promise<T[]> {
    const results: T[] = [];
    for (const item of this.store.values()) {
      if (predicate(item)) results.push(item);
    }
    return results;
  }
}
