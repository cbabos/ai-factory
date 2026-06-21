import { describe, it, expect } from "vitest";
import { WebhookSensor } from "../webhook-sensor.js";

describe("WebhookSensor", () => {
  it("emits a signal from an HTTP POST", async () => {
    const sensor = new WebhookSensor(0);
    const events: unknown[] = [];
    sensor.signals.subscribe((signal) => { events.push(signal); });

    sensor.start();
    const port = sensor.getPort();
    expect(port).toBeDefined();

    const response = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "deploy" }),
    });
    expect(response.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toHaveLength(1);

    const event = events[0] as { payload: { body: string } };
    expect(event.payload.body).toBe("deploy");

    sensor.stop();
  });

  it("emits a signal from manual inject", () => {
    const sensor = new WebhookSensor(0);
    const events: unknown[] = [];
    sensor.signals.subscribe((signal) => { events.push(signal); });

    sensor.inject({ body: "manual" }, { callbackUrl: "https://example.com" });

    expect(events).toHaveLength(1);
  });
});
