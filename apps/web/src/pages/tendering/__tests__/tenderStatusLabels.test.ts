import { describe, it, expect } from "vitest";
import {
  TENDER_STATUSES,
  TENDER_STATUS_LABEL,
  TENDER_STATUS_ACCENT,
  type TenderStatus
} from "../tenderStatusLabels";

describe("tenderStatusLabels", () => {
  const expectedStatuses: TenderStatus[] = [
    "DRAFT",
    "IN_PROGRESS",
    "SUBMITTED",
    "AWARDED",
    "CONTRACT_ISSUED",
    "LOST",
    "WITHDRAWN"
  ];

  it("TENDER_STATUSES contains all 7 values in canonical order", () => {
    expect([...TENDER_STATUSES]).toEqual(expectedStatuses);
  });

  it("TENDER_STATUS_LABEL maps every status to the canonical label", () => {
    expect(TENDER_STATUS_LABEL).toEqual({
      DRAFT: "Draft",
      IN_PROGRESS: "Estimating",
      SUBMITTED: "Submitted",
      AWARDED: "Awarded",
      CONTRACT_ISSUED: "Contract",
      LOST: "Lost",
      WITHDRAWN: "Withdrawn"
    });
  });

  it("TENDER_STATUS_ACCENT has an entry for every status", () => {
    for (const status of expectedStatuses) {
      expect(TENDER_STATUS_ACCENT[status]).toBeDefined();
      expect(typeof TENDER_STATUS_ACCENT[status]).toBe("string");
    }
  });

  it("label and accent maps have exactly the same keys as TENDER_STATUSES", () => {
    const labelKeys = Object.keys(TENDER_STATUS_LABEL).sort();
    const accentKeys = Object.keys(TENDER_STATUS_ACCENT).sort();
    const statusKeys = [...TENDER_STATUSES].sort();
    expect(labelKeys).toEqual(statusKeys);
    expect(accentKeys).toEqual(statusKeys);
  });
});
