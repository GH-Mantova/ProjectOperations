import { describe, expect, it } from "vitest";
import { countComplianceAlerts, isComplianceAlert } from "../complianceCounts";

describe("isComplianceAlert", () => {
  it("flags expired and expiring statuses", () => {
    expect(isComplianceAlert({ status: "expired" })).toBe(true);
    expect(isComplianceAlert({ status: "expiring_7" })).toBe(true);
    expect(isComplianceAlert({ status: "expiring_30" })).toBe(true);
  });

  it("ignores active and not_set rows", () => {
    expect(isComplianceAlert({ status: "active" })).toBe(false);
    expect(isComplianceAlert({ status: "not_set" })).toBe(false);
  });
});

describe("countComplianceAlerts", () => {
  it("returns 0 for null/empty input", () => {
    expect(countComplianceAlerts(null)).toBe(0);
    expect(countComplianceAlerts(undefined)).toBe(0);
    expect(countComplianceAlerts({})).toBe(0);
    expect(countComplianceAlerts({ licences: [], insurances: [], qualifications: [] })).toBe(0);
  });

  it("sums alert-bucket rows across licences, insurances, and qualifications", () => {
    const data = {
      licences: [{ status: "expired" as const }, { status: "active" as const }],
      insurances: [{ status: "expiring_7" as const }],
      qualifications: [
        { status: "expiring_30" as const },
        { status: "active" as const },
        { status: "not_set" as const }
      ]
    };
    expect(countComplianceAlerts(data)).toBe(3);
  });

  it("matches the seed-fresh expectation (1 expired licence + 1 expiring insurance + 2 expiring quals = 4)", () => {
    const data = {
      licences: [{ status: "expired" as const }],
      insurances: [{ status: "expiring_30" as const }],
      qualifications: [{ status: "expiring_7" as const }, { status: "expiring_30" as const }]
    };
    expect(countComplianceAlerts(data)).toBe(4);
  });
});
