import type { HealthStatus } from "./types.js";

export interface IHealthChecker {
  check(): HealthStatus;
  destroy(): void;
}

export type HealthCheck = () => { name: string; ok: boolean; message?: string };

export class HealthChecker implements IHealthChecker {
  private checks: HealthCheck[];
  private timer?: ReturnType<typeof setInterval>;
  private lastStatus: HealthStatus;

  constructor(checks: HealthCheck[], intervalMs = 30_000) {
    this.checks = checks;
    this.lastStatus = this.runChecks();
    this.timer = setInterval(() => {
      this.lastStatus = this.runChecks();
    }, intervalMs);
  }

  check(): HealthStatus {
    return this.lastStatus;
  }

  forceCheck(): HealthStatus {
    this.lastStatus = this.runChecks();
    return this.lastStatus;
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private runChecks(): HealthStatus {
    const checks: HealthStatus["checks"] = {};
    let degraded = false;
    let unhealthy = false;

    for (const check of this.checks) {
      const result = check();
      checks[result.name] = { ok: result.ok, message: result.message };
      if (!result.ok) unhealthy = true;
      else if (result.message) degraded = true;
    }

    return {
      status: unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy",
      checks,
    };
  }
}
