import type { Task, Priority } from "./types.js";
import type { IPrioritizer } from "./interfaces.js";

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  batch: 3,
};

export class Prioritizer implements IPrioritizer {
  prioritize(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      return a.createdAt - b.createdAt;
    });
  }
}
