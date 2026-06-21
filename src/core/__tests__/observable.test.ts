import { describe, it, expect, vi } from "vitest";
import { Subject } from "../observable.js";
import { NoopLogger } from "../logger.js";

describe("Subject", () => {
  it("calls synchronous subscribers", () => {
    const subject = new Subject<string>();
    const handler = vi.fn();
    subject.subscribe(handler);
    subject.next("hello");
    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("calls multiple subscribers", () => {
    const subject = new Subject<number>();
    const a = vi.fn();
    const b = vi.fn();
    subject.subscribe(a);
    subject.subscribe(b);
    subject.next(42);
    expect(a).toHaveBeenCalledWith(42);
    expect(b).toHaveBeenCalledWith(42);
  });

  it("removes subscriber on unsubscribe", () => {
    const subject = new Subject<string>();
    const handler = vi.fn();
    const sub = subject.subscribe(handler);
    sub.unsubscribe();
    subject.next("ignored");
    expect(handler).not.toHaveBeenCalled();
  });

  it("handles async subscribers", async () => {
    const subject = new Subject<string>();
    let resolved = "";
    subject.subscribe(async (value) => {
      resolved = value;
    });
    subject.next("async");
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe("async");
  });

  it("does not throw when a handler throws", () => {
    const subject = new Subject<string>(new NoopLogger());
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error("boom");
    });
    const goodHandler = vi.fn();
    subject.subscribe(errorHandler);
    subject.subscribe(goodHandler);
    expect(() => subject.next("x")).not.toThrow();
    expect(goodHandler).toHaveBeenCalledWith("x");
  });

  it("tracks subscriber count", () => {
    const subject = new Subject<string>();
    const a = subject.subscribe(() => {});
    expect(subject.subscriberCount).toBe(1);
    const b = subject.subscribe(() => {});
    expect(subject.subscriberCount).toBe(2);
    b.unsubscribe();
    expect(subject.subscriberCount).toBe(1);
    a.unsubscribe();
    expect(subject.subscriberCount).toBe(0);
  });
});
