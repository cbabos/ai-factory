import { describe, it, expect } from "vitest";
import { FileWatcherSensor } from "../file-watcher-sensor.js";

describe("FileWatcherSensor", () => {
  it("emits a signal from manual inject", () => {
    const sensor = new FileWatcherSensor("/tmp");
    const events: unknown[] = [];
    sensor.signals.subscribe((signal) => { events.push(signal); });

    sensor.inject("/tmp/file.txt", "add");

    expect(events).toHaveLength(1);
    const event = events[0] as { payload: { filePath: string } };
    expect(event.payload.filePath).toBe("/tmp/file.txt");
  });
});
