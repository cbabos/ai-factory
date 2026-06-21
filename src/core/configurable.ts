import type { FactoryConfig } from "./types.js";
import type { IConfigurable } from "./interfaces.js";

export abstract class Configurable<TConfig = FactoryConfig> implements IConfigurable<TConfig> {
  private _config!: TConfig;

  get config(): TConfig {
    return this._config;
  }

  loadConfig(config: TConfig): void {
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid config for ${this.constructor.name}: ${errors.join("; ")}`);
    }
    this._config = config;
  }

  abstract validateConfig(config: TConfig): string[];
}
