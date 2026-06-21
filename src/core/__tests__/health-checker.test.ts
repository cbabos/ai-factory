import { describe, it, expect, vi } from "vitest";
import { HealthChecker } from "../health-checker.js";

describe("HealthChecker", () => {
  it("reports healthy when all checks pass", () => {
    const checker = new HealthChecker([
      () => ({ name: "a", ok: true }),
      () => ({ name: "b", ok: true }),
    ]);
    expect(checker.check().status).toBe("healthy");
    checker.destroy();
  });

  it("reports degraded when a check has a message", () => {
    const checker = new HealthChecker([
      () => ({ name: "a", ok: true, message: "slow" }),
      () => ({ name: "b", ok: true }),
    ]);
    expect(checker.check().status).toBe("degraded");
    checker.destroy();
  });

  it("reports unhealthy when a check fails", () => {
    const checker = new HealthChecker([
      () => ({ name: "a", ok: false, message: "down" }),
      () => ({ name: "b", ok: true }),
    ]);
    expect(checker.check().status).toBe("unhealthy");
    checker.destroy();
  });

  it("updates status on forceCheck", () => {
    let ok = true;
    const checker = new HealthChecker([
      () => ({ name: "a", ok, message: ok ? undefined : "failed" }),
    ]);
    expect(checker.check().status).toBe("healthy");

    ok = false;
    expect(checker.forceCheck().status).toBe("unhealthy");
    checker.destroy();
  });

  it("runs periodic checks", async () => {
    vi.useFakeTimers();
    let value = true;
    const checker = new HealthChecker(
      [() => ({ name: "a", ok: value })],
      1000,
    );

    value = false;
    await vi.advanceTimersByTimeAsync(1500);
    expect(checker.check().status).toBe("unhealthy");

    vi.useRealTimers();
    checker.destroy();
  });
});
