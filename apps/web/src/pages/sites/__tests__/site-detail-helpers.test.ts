import { describe, expect, it } from "vitest";
import {
  formatKpiCount,
  formatSiteAddress,
  formatSiteDate,
  projectStatusBadgeClass,
  resolveSiteTab,
  tenderStatusBadgeClass
} from "../site-detail-helpers";

describe("formatSiteAddress", () => {
  it("joins populated parts with comma separators", () => {
    expect(
      formatSiteAddress({
        addressLine1: "12 Main St",
        suburb: "Logan",
        state: "QLD",
        postcode: "4000"
      })
    ).toBe("12 Main St, Logan, QLD, 4000");
  });

  it("includes addressLine2 between line1 and suburb when present", () => {
    expect(
      formatSiteAddress({
        addressLine1: "12 Main St",
        addressLine2: "Unit 4",
        suburb: "Logan",
        state: "QLD",
        postcode: "4000"
      })
    ).toBe("12 Main St, Unit 4, Logan, QLD, 4000");
  });

  it("skips null, undefined, and blank parts without leaving trailing commas", () => {
    expect(
      formatSiteAddress({
        addressLine1: "12 Main St",
        addressLine2: null,
        suburb: "",
        state: "QLD",
        postcode: undefined
      })
    ).toBe("12 Main St, QLD");
  });

  it("trims whitespace before joining so padded strings don't widen the output", () => {
    expect(
      formatSiteAddress({
        addressLine1: "  12 Main St ",
        suburb: " Logan  ",
        state: "QLD"
      })
    ).toBe("12 Main St, Logan, QLD");
  });

  it("returns the em-dash placeholder when every part is empty or missing", () => {
    expect(formatSiteAddress(null)).toBe("—");
    expect(formatSiteAddress(undefined)).toBe("—");
    expect(formatSiteAddress({})).toBe("—");
    expect(formatSiteAddress({ addressLine1: "", suburb: "   " })).toBe("—");
  });
});

describe("tenderStatusBadgeClass", () => {
  it("maps awarded/contract-issued statuses to the active variant", () => {
    expect(tenderStatusBadgeClass("AWARDED")).toBe("s7-badge s7-badge--active");
    expect(tenderStatusBadgeClass("CONTRACT_ISSUED")).toBe("s7-badge s7-badge--active");
  });

  it("maps submitted to warning and in_progress to info", () => {
    expect(tenderStatusBadgeClass("SUBMITTED")).toBe("s7-badge s7-badge--warning");
    expect(tenderStatusBadgeClass("IN_PROGRESS")).toBe("s7-badge s7-badge--info");
  });

  it("maps lost to danger and draft/withdrawn/unknown to neutral", () => {
    expect(tenderStatusBadgeClass("LOST")).toBe("s7-badge s7-badge--danger");
    expect(tenderStatusBadgeClass("DRAFT")).toBe("s7-badge s7-badge--neutral");
    expect(tenderStatusBadgeClass("WITHDRAWN")).toBe("s7-badge s7-badge--neutral");
    expect(tenderStatusBadgeClass("MYSTERY")).toBe("s7-badge s7-badge--neutral");
    expect(tenderStatusBadgeClass(null)).toBe("s7-badge s7-badge--neutral");
    expect(tenderStatusBadgeClass(undefined)).toBe("s7-badge s7-badge--neutral");
  });

  it("treats lowercase input the same as uppercase", () => {
    expect(tenderStatusBadgeClass("awarded")).toBe("s7-badge s7-badge--active");
  });
});

describe("projectStatusBadgeClass", () => {
  it("maps ACTIVE / PRACTICAL_COMPLETION to active", () => {
    expect(projectStatusBadgeClass("ACTIVE")).toBe("s7-badge s7-badge--active");
    expect(projectStatusBadgeClass("PRACTICAL_COMPLETION")).toBe("s7-badge s7-badge--active");
  });

  it("maps MOBILISING to info and DEFECTS to warning", () => {
    expect(projectStatusBadgeClass("MOBILISING")).toBe("s7-badge s7-badge--info");
    expect(projectStatusBadgeClass("DEFECTS")).toBe("s7-badge s7-badge--warning");
  });

  it("maps CLOSED and unknown statuses to neutral", () => {
    expect(projectStatusBadgeClass("CLOSED")).toBe("s7-badge s7-badge--neutral");
    expect(projectStatusBadgeClass("???")).toBe("s7-badge s7-badge--neutral");
    expect(projectStatusBadgeClass(null)).toBe("s7-badge s7-badge--neutral");
  });
});

describe("formatSiteDate", () => {
  it("renders dd Mon yyyy from an ISO timestamp regardless of timezone", () => {
    expect(formatSiteDate("2026-06-02T05:00:00.000Z")).toBe("02 Jun 2026");
  });

  it("renders a date-only string", () => {
    expect(formatSiteDate("2026-01-15")).toBe("15 Jan 2026");
  });

  it("returns the em-dash placeholder for null / empty / undefined", () => {
    expect(formatSiteDate(null)).toBe("—");
    expect(formatSiteDate(undefined)).toBe("—");
    expect(formatSiteDate("")).toBe("—");
    expect(formatSiteDate("   ")).toBe("—");
  });

  it("returns the original string when parsing fails", () => {
    expect(formatSiteDate("not-a-date")).toBe("not-a-date");
  });
});

describe("resolveSiteTab", () => {
  it("returns the matching tab when known", () => {
    expect(resolveSiteTab("overview")).toBe("overview");
    expect(resolveSiteTab("tenders")).toBe("tenders");
    expect(resolveSiteTab("projects")).toBe("projects");
    expect(resolveSiteTab("documents")).toBe("documents");
  });

  it("falls back to overview for missing or unknown values", () => {
    expect(resolveSiteTab(null)).toBe("overview");
    expect(resolveSiteTab(undefined)).toBe("overview");
    expect(resolveSiteTab("")).toBe("overview");
    expect(resolveSiteTab("foo")).toBe("overview");
  });
});

describe("formatKpiCount", () => {
  it("renders zero and small counts as-is", () => {
    expect(formatKpiCount(0)).toBe("0");
    expect(formatKpiCount(1)).toBe("1");
    expect(formatKpiCount(42)).toBe("42");
    expect(formatKpiCount(999)).toBe("999");
  });

  it("caps four-digit-and-up counts at 999+", () => {
    expect(formatKpiCount(1000)).toBe("999+");
    expect(formatKpiCount(15234)).toBe("999+");
  });

  it("guards against negative or non-finite values", () => {
    expect(formatKpiCount(-3)).toBe("0");
    expect(formatKpiCount(Number.NaN)).toBe("0");
    expect(formatKpiCount(Number.POSITIVE_INFINITY)).toBe("0");
  });
});
