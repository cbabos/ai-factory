export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export class ConsoleLogger implements ILogger {
  private readonly level: number;
  private readonly prefix: string;

  constructor(options?: { level?: LogLevel; namespace?: string }) {
    this.level = LEVELS[options?.level ?? "info"];
    this.prefix = options?.namespace ? `[${options.namespace}]` : "";
  }

  debug(...args: unknown[]): void {
    this.log("debug", console.log, ...args);
  }

  info(...args: unknown[]): void {
    this.log("info", console.log, ...args);
  }

  warn(...args: unknown[]): void {
    this.log("warn", console.warn, ...args);
  }

  error(...args: unknown[]): void {
    this.log("error", console.error, ...args);
  }

  private log(
    level: LogLevel,
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ): void {
    if (LEVELS[level] < this.level) return;
    if (this.prefix) {
      fn(this.prefix, ...args);
    } else {
      fn(...args);
    }
  }
}

export class NoopLogger implements ILogger {
  debug(..._args: unknown[]): void {}
  info(..._args: unknown[]): void {}
  warn(..._args: unknown[]): void {}
  error(..._args: unknown[]): void {}
}
