import { describe, expect, it } from "vitest";
import { eligibilityReason } from "../JobSorRegisterPage";

// ── Helpers ────────────────────────────────────────────────────────────────

type ClaimedOn = {
  claimId: string;
  claimMonth: string;
  claimStatus: string;
};

function makeVariationRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: "VARIATION" as const,
    id: "var-1",
    number: "VAR-001",
    description: "Extra excavation",
    status: "APPROVED",
    sorVersion: "2026-H1-v3",
    amount: "1000.00",
    isEligible: true,
    claimedOn: null as ClaimedOn | null,
    createdAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeArRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: "AGREED_RECORD" as const,
    id: "ar-1",
    number: "AR-000001",
    description: "Dayworks — traffic control",
    status: "APPROVED",
    sorVersion: "2026-H1-v3",
    amount: "500.00",
    workerSigned: true,
    clientRepSigned: true,
    isEligible: true,
    claimedOn: null as ClaimedOn | null,
    createdAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("eligibilityReason — SOR_CLAIM_ONCE_V1", () => {
  // ── (6) claimed item returns "Already claimed — Sep 2026 claim" ──────────

  it("(6) returns 'Already claimed — Sep 2026 claim' for a claimed AR that is otherwise eligible", () => {
    const row = makeArRow({
      claimedOn: {
        claimId: "claim-sep",
        claimMonth: "2026-09-01T00:00:00.000Z",
        claimStatus: "DRAFT",
      },
    });
    // Not in the eligible set (because it is claimed).
    const eligibleIds = new Set<string>();

    const reason = eligibilityReason(row, eligibleIds);
    expect(reason).toBe("Already claimed — Sep 2026 claim");
  });

  it("(6b) returns 'Already claimed — Oct 2026 claim' for October", () => {
    const row = makeArRow({
      claimedOn: {
        claimId: "claim-oct",
        claimMonth: "2026-10-01T00:00:00.000Z",
        claimStatus: "SUBMITTED",
      },
    });
    const eligibleIds = new Set<string>();

    expect(eligibilityReason(row, eligibleIds)).toBe("Already claimed — Oct 2026 claim");
  });

  it("(6c) returns 'Already claimed — Aug 2026 claim' for a VC claimed in August", () => {
    const row = makeVariationRow({
      claimedOn: {
        claimId: "claim-aug",
        claimMonth: "2026-08-01T00:00:00.000Z",
        claimStatus: "APPROVED",
      },
    });
    const eligibleIds = new Set<string>();

    expect(eligibilityReason(row, eligibleIds)).toBe("Already claimed — Aug 2026 claim");
  });

  // ── Existing reasons still work ──────────────────────────────────────────

  it("returns null for an eligible item", () => {
    const row = makeArRow();
    const eligibleIds = new Set(["ar-1"]);
    expect(eligibilityReason(row, eligibleIds)).toBeNull();
  });

  it("returns 'Not approved' for a VC with no approved amount (not in eligible set)", () => {
    const row = makeVariationRow({ status: "DRAFT" });
    const eligibleIds = new Set<string>();
    expect(eligibilityReason(row, eligibleIds)).toBe("Not approved");
  });

  it("returns 'Not approved' for an AR with DRAFT status", () => {
    const row = makeArRow({ status: "DRAFT" });
    const eligibleIds = new Set<string>();
    expect(eligibilityReason(row, eligibleIds)).toBe("Not approved");
  });

  it("returns 'Missing worker signature' for an AR missing worker sig", () => {
    const row = makeArRow({ workerSigned: false });
    const eligibleIds = new Set<string>();
    expect(eligibilityReason(row, eligibleIds)).toBe("Missing worker signature");
  });

  it("returns 'Missing client-rep signature' for an AR missing client-rep sig", () => {
    const row = makeArRow({ clientRepSigned: false });
    const eligibleIds = new Set<string>();
    expect(eligibilityReason(row, eligibleIds)).toBe("Missing client-rep signature");
  });

  it("claimed check takes priority over signature check", () => {
    // Even if worker sig is missing, claimedOn check fires first.
    const row = makeArRow({
      workerSigned: false,
      claimedOn: {
        claimId: "claim-sep",
        claimMonth: "2026-09-01T00:00:00.000Z",
        claimStatus: "DRAFT",
      },
    });
    const eligibleIds = new Set<string>();
    expect(eligibilityReason(row, eligibleIds)).toBe("Already claimed — Sep 2026 claim");
  });
});
