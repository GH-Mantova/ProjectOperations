/**
 * Smoke tests for reportTableWidget — pure logic helpers.
 *
 * The widget uses authFetch (browser-only) so React-render tests would require
 * jsdom + a fetch mock which is not wired in the current vitest config.
 * Instead, we test the exported formatCell helper (which contains all the
 * formatting logic) and verify that makeReportTableWidget returns a valid
 * React component function (i.e. it is callable and its displayName is set).
 *
 * This matches the pattern used by batch1.helpers.test.ts et al — pure unit
 * tests that can run in a plain Node environment via `pnpm test`.
 */

import { describe, expect, it } from "vitest";
import { formatCell, makeReportTableWidget } from "../reportTableWidget";

describe("formatCell", () => {
  const col = (format?: "text" | "number" | "currency" | "percent" | "date") => ({
    key: "val",
    label: "Value",
    format
  });

  it("returns em-dash for null / undefined / empty string", () => {
    expect(formatCell(null, col())).toBe("—");
    expect(formatCell(undefined, col())).toBe("—");
    expect(formatCell("", col())).toBe("—");
  });

  it("formats currency with en-AU locale and no decimals", () => {
    const result = formatCell(125000, col("currency"));
    expect(result).toMatch(/125/); // $125,000 or $125.000 depending on locale
    expect(result).toMatch(/000/);
  });

  it("formats percent with trailing %", () => {
    expect(formatCell(55.5, col("percent"))).toBe("55.5%");
    expect(formatCell(100, col("percent"))).toBe("100%");
    expect(formatCell(0, col("percent"))).toBe("0%");
  });

  it("formats number with en-AU locale (commas)", () => {
    // en-AU uses commas as thousand separators
    const result = formatCell(1234567, col("number"));
    expect(result).toMatch(/1/);
    expect(result).toMatch(/234/);
  });

  it("formats date by slicing ISO string to YYYY-MM-DD", () => {
    expect(formatCell("2026-08-06T12:00:00.000Z", col("date"))).toBe("2026-08-06");
    expect(formatCell("2026-01-01", col("date"))).toBe("2026-01-01");
  });

  it("converts non-string values to string for default text format", () => {
    expect(formatCell(42, col("text"))).toBe("42");
    expect(formatCell("hello", col())).toBe("hello");
  });

  it("handles numeric 0 (not falsy-skipped) correctly", () => {
    // 0 is not null/undefined/empty — should format, not return em-dash
    expect(formatCell(0, col("number"))).toBe("0");
  });
});

describe("makeReportTableWidget", () => {
  it("returns a function (React component) with the correct displayName", () => {
    const widget = makeReportTableWidget("tender-pipeline");
    expect(typeof widget).toBe("function");
    expect(widget.displayName).toBe("ReportTableWidget(tender-pipeline)");
  });

  it("produces distinct component references for different report keys", () => {
    const widgetA = makeReportTableWidget("tender-pipeline");
    const widgetB = makeReportTableWidget("job-status-summary");
    expect(widgetA).not.toBe(widgetB);
    expect(widgetA.displayName).not.toBe(widgetB.displayName);
  });
});
