import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { ConsoleLogger, NoopLogger } from "../logger.js";

describe("ConsoleLogger", () => {
  let logSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs at default info level", () => {
    const logger = new ConsoleLogger({ namespace: "Test" });
    logger.debug("hidden");
    logger.info("visible");
    logger.warn("visible");
    logger.error("visible");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("[Test]", "visible");
    expect(warnSpy).toHaveBeenCalledWith("[Test]", "visible");
    expect(errorSpy).toHaveBeenCalledWith("[Test]", "visible");
  });

  it("logs debug when level is debug", () => {
    const logger = new ConsoleLogger({ level: "debug" });
    logger.debug("debug msg");
    expect(logSpy).toHaveBeenCalledWith("debug msg");
  });

  it("filters out info and below when level is warn", () => {
    const logger = new ConsoleLogger({ level: "warn" });
    logger.debug("hidden");
    logger.info("hidden");
    logger.warn("warn msg");
    logger.error("error msg");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("warn msg");
    expect(errorSpy).toHaveBeenCalledWith("error msg");
  });

  it("supports varargs", () => {
    const logger = new ConsoleLogger();
    logger.info("a", "b", 1);
    expect(logSpy).toHaveBeenCalledWith("a", "b", 1);
  });
});

describe("NoopLogger", () => {
  it("does not call console methods", () => {
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const logger = new NoopLogger();
    logger.debug("x");
    logger.info("x");
    logger.warn("x");
    logger.error("x");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
