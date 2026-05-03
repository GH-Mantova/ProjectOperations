import { describe, expect, it } from "vitest";
import { formatRelativeDate, truncatePreview } from "../date-helpers";

const NOW = new Date("2026-05-03T15:00:00");

describe("formatRelativeDate", () => {
  it("formats today with time", () => {
    const result = formatRelativeDate(new Date("2026-05-03T11:30:00"), NOW);
    expect(result).toMatch(/^Today, /);
  });

  it("formats yesterday with time", () => {
    const result = formatRelativeDate(new Date("2026-05-02T16:20:00"), NOW);
    expect(result).toMatch(/^Yesterday, /);
  });

  it("formats 'N days ago' for 2-6 days", () => {
    expect(formatRelativeDate(new Date("2026-05-01T10:00:00"), NOW)).toBe("2 days ago");
    expect(formatRelativeDate(new Date("2026-04-28T10:00:00"), NOW)).toBe("5 days ago");
  });

  it("formats '1 week ago' / 'N weeks ago' for 7-41 days", () => {
    expect(formatRelativeDate(new Date("2026-04-25T10:00:00"), NOW)).toBe("1 week ago");
    expect(formatRelativeDate(new Date("2026-04-12T10:00:00"), NOW)).toBe("3 weeks ago");
  });

  it("formats month + day for ≥6 weeks same year (no year, locale-tolerant)", () => {
    const result = formatRelativeDate(new Date("2026-03-12T10:00:00"), NOW);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/12/);
    expect(result).not.toMatch(/2026/);
  });

  it("includes year for prior years", () => {
    const result = formatRelativeDate(new Date("2025-03-12T10:00:00"), NOW);
    expect(result).toMatch(/2025/);
  });

  it("returns empty string for invalid dates", () => {
    expect(formatRelativeDate("not-a-date", NOW)).toBe("");
  });

  it("accepts ISO strings", () => {
    expect(formatRelativeDate("2026-05-03T11:30:00", NOW)).toMatch(/^Today, /);
  });
});

describe("truncatePreview", () => {
  it("returns the input untrimmed when under the limit", () => {
    expect(truncatePreview("short message")).toBe("short message");
  });
  it("truncates with an ellipsis when over the limit", () => {
    const long = "a".repeat(200);
    const result = truncatePreview(long, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("…")).toBe(true);
  });
  it("returns '(empty)' for null/undefined/empty", () => {
    expect(truncatePreview(null)).toBe("(empty)");
    expect(truncatePreview(undefined)).toBe("(empty)");
    expect(truncatePreview("")).toBe("(empty)");
  });
  it("trims whitespace before truncating", () => {
    expect(truncatePreview("   hello world   ")).toBe("hello world");
  });
});
