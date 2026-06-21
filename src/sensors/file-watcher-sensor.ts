import chokidar from "chokidar";
import type { RawSignal, Channel } from "../core/types.js";
import type { ISensor } from "../core/interfaces.js";
import { Subject } from "../core/observable.js";
import { NoopLogger, type ILogger } from "../core/logger.js";

export class FileWatcherSensor implements ISensor {
  readonly channel: Channel = "filesystem";
  readonly signals: Subject<RawSignal>;

  private watcher?: ReturnType<typeof chokidar.watch>;

  constructor(
    private path: string,
    logger?: ILogger,
  ) {
    this.signals = new Subject<RawSignal>(logger ?? new NoopLogger());
  }

  start(): void {
    this.watcher = chokidar.watch(this.path, { ignoreInitial: true });
    this.watcher.on("add", (filePath) => this.emit(filePath, "add"));
    this.watcher.on("change", (filePath) => this.emit(filePath, "change"));
  }

  stop(): void {
    void this.watcher?.close();
    this.watcher = undefined;
  }

  // Exposed for manual injection in tests/stubs
  inject(filePath: string, changeType: string): void {
    this.emit(filePath, changeType);
  }

  private emit(filePath: string, changeType: string): void {
    this.signals.next({
      channel: "filesystem",
      payload: { filePath, changeType },
      receivedAt: Date.now(),
      metadata: { changeType },
    });
  }
}
