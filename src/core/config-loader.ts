import { readFileSync } from "node:fs";
import type { FactoryConfig } from "./types.js";

export function loadConfig(path: string): FactoryConfig {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as FactoryConfig;
}
