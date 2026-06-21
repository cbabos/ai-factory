import { describe, it, expect } from "vitest";
import { EmailSensor } from "../email-sensor.js";

describe("EmailSensor", () => {
  it("emits a signal from manual inject", () => {
    const sensor = new EmailSensor({
      host: "imap.example.com",
      port: 993,
      user: "user",
      password: "pass",
    });
    const events: unknown[] = [];
    sensor.signals.subscribe((signal) => { events.push(signal); });

    sensor.inject(
      { subject: "Hello", text: "body" },
      { messageId: "msg-1" },
    );

    expect(events).toHaveLength(1);
    const event = events[0] as { payload: { subject: string } };
    expect(event.payload.subject).toBe("Hello");
  });
});
