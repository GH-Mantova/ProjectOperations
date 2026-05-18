// PR fix/B01 — ErrorBoundary specs.
// The web workspace has no @testing-library / jsdom set up (all
// existing web tests are pure logic), so we exercise the class
// directly: the static factory, componentDidCatch's dev-mode log,
// and reset's onReset callback. Rendered-output behaviour will be
// covered by E2E once a deliberate-throw test surface exists.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

describe("ErrorBoundary (PR fix/B01)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getDerivedStateFromError sets hasError=true and stores the error", () => {
    const err = new Error("boom");
    const next = ErrorBoundary.getDerivedStateFromError(err);
    expect(next.hasError).toBe(true);
    expect(next.error).toBe(err);
  });

  it("constructs with hasError=false and null error", () => {
    const boundary = new ErrorBoundary({ sectionName: "Test", children: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });

  it("componentDidCatch logs in DEV mode with the section name", () => {
    // import.meta.env.DEV is true under vitest by default — assert
    // the log fires and carries the section prefix.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = new ErrorBoundary({ sectionName: "Issues", children: null });
    boundary.componentDidCatch(new Error("kaboom"), { componentStack: "  in Foo" });
    expect(spy).toHaveBeenCalledTimes(1);
    const [msg] = spy.mock.calls[0] ?? [];
    expect(String(msg)).toContain("[ErrorBoundary:Issues]");
  });

  it("reset clears error state and calls onReset prop when provided", () => {
    const onReset = vi.fn();
    const boundary = new ErrorBoundary({ sectionName: "Test", onReset, children: null });
    // Simulate the post-error state without going through React's
    // setState (which needs a mounted updater). reset() also calls
    // setState — stub it to verify the new state shape.
    boundary.state = { hasError: true, error: new Error("x") };
    const setStateSpy = vi
      .spyOn(boundary, "setState")
      .mockImplementation(((partial: { hasError: boolean; error: Error | null }) => {
        boundary.state = { ...boundary.state, ...partial };
      }) as never);
    boundary.reset();
    expect(setStateSpy).toHaveBeenCalledWith({ hasError: false, error: null });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });

  it("reset works without an onReset prop (optional)", () => {
    const boundary = new ErrorBoundary({ sectionName: "Test", children: null });
    boundary.state = { hasError: true, error: new Error("x") };
    vi.spyOn(boundary, "setState").mockImplementation(((partial: { hasError: boolean }) => {
      boundary.state = { ...boundary.state, ...partial };
    }) as never);
    expect(() => boundary.reset()).not.toThrow();
  });
});
