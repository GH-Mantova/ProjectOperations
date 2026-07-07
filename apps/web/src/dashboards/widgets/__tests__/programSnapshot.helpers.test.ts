import { describe, expect, it } from "vitest";
import { clipTaskToWindow, type SnapshotTask } from "../programSnapshot.helpers";

const task = (start: string, end: string): SnapshotTask => ({
  id: "t1",
  title: "Excavate",
  discipline: "CIV",
  startDate: start,
  endDate: end,
  progress: 0,
  colour: null
});

const WINDOW_START = new Date("2026-07-01T00:00:00Z");
const WINDOW_END = new Date("2026-07-29T00:00:00Z"); // 28 days

describe("clipTaskToWindow", () => {
  it("returns null for a task entirely before the window", () => {
    const result = clipTaskToWindow(task("2026-06-01", "2026-06-15"), WINDOW_START, WINDOW_END);
    expect(result).toBeNull();
  });

  it("returns null for a task entirely after the window", () => {
    const result = clipTaskToWindow(task("2026-08-01", "2026-08-15"), WINDOW_START, WINDOW_END);
    expect(result).toBeNull();
  });

  it("clips the left edge when the task starts before the window", () => {
    const result = clipTaskToWindow(task("2026-06-25", "2026-07-08"), WINDOW_START, WINDOW_END);
    expect(result).not.toBeNull();
    expect(result!.offsetPct).toBe(0);
    // 8 days visible of the 28-day window ≈ 28.57%
    expect(result!.widthPct).toBeGreaterThan(20);
    expect(result!.widthPct).toBeLessThan(35);
  });

  it("clips the right edge when the task ends after the window", () => {
    const result = clipTaskToWindow(task("2026-07-22", "2026-08-15"), WINDOW_START, WINDOW_END);
    expect(result).not.toBeNull();
    expect(result!.offsetPct).toBeGreaterThan(70);
    expect(result!.offsetPct + result!.widthPct).toBeLessThanOrEqual(100.5);
  });

  it("preserves task fields when clipping", () => {
    const result = clipTaskToWindow(task("2026-07-05", "2026-07-12"), WINDOW_START, WINDOW_END);
    expect(result?.title).toBe("Excavate");
    expect(result?.discipline).toBe("CIV");
  });

  it("guarantees a minimum visible width so zero-length bars stay clickable", () => {
    // Same-day task inside the window
    const result = clipTaskToWindow(task("2026-07-10T12:00:00Z", "2026-07-10T12:00:00Z"), WINDOW_START, WINDOW_END);
    expect(result).not.toBeNull();
    expect(result!.widthPct).toBeGreaterThanOrEqual(0.5);
  });
});
