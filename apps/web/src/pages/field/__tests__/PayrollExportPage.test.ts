// PayrollExportPage — helper-level specs.
//
// The web workspace has no jsdom / @testing-library set up (see
// NoAccess.test.tsx). The testable seam for this page is the URL builder
// that the "Download CSV" button hands to authFetch — if this ever drifts
// away from the endpoint the FieldController actually exposes, the CSV
// download silently 404s. This spec pins the request shape.

import { describe, expect, it } from "vitest";
import {
  buildPayrollExportFilename,
  buildPayrollExportUrl
} from "../PayrollExportPage";

describe("PayrollExportPage — buildPayrollExportUrl", () => {
  it("targets the FieldController payroll-export endpoint", () => {
    const url = buildPayrollExportUrl("2026-05-01", "2026-05-14");
    expect(url.startsWith("/field/timesheets/payroll-export.csv?")).toBe(true);
  });

  it("passes the selected from/to as query params (matches PayrollExportQueryDto)", () => {
    const url = buildPayrollExportUrl("2026-05-01", "2026-05-14");
    const query = new URLSearchParams(url.split("?")[1]);
    expect(query.get("from")).toBe("2026-05-01");
    expect(query.get("to")).toBe("2026-05-14");
  });

  it("URL-encodes date input so odd values cannot break the request line", () => {
    const url = buildPayrollExportUrl("2026-05-01", "2026 05 14");
    const query = new URLSearchParams(url.split("?")[1]);
    // Whitespace round-trips via URLSearchParams decoding.
    expect(query.get("to")).toBe("2026 05 14");
  });
});

describe("PayrollExportPage — buildPayrollExportFilename", () => {
  it("names the download with both endpoints of the range", () => {
    expect(buildPayrollExportFilename("2026-05-01", "2026-05-14")).toBe(
      "approved-timesheets_2026-05-01_to_2026-05-14.csv"
    );
  });
});
