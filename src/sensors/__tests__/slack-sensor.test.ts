import { describe, it, expect } from "vitest";
import { SlackSensor } from "../slack-sensor.js";

describe("SlackSensor", () => {
  it("emits a signal from manual inject", () => {
    const sensor = new SlackSensor({
      token: "xoxb-test",
      signingSecret: "secret",
    });
    const events: unknown[] = [];
    sensor.signals.subscribe((signal) => { events.push(signal); });

    sensor.inject({ text: "hello", channel: "C123" }, { threadTs: "1234.56" });

    expect(events).toHaveLength(1);
    const event = events[0] as { payload: { text: string } };
    expect(event.payload.text).toBe("hello");
  });
});
