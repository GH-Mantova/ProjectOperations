import {
  WON_TENDER_STATUSES,
  LOST_TENDER_STATUSES,
  LEGACY_CLOSED_TENDER_STATUSES,
  TERMINAL_TENDER_STATUSES,
  HISTORY_TENDER_STATUSES,
  isTerminalTenderStatus
} from "../tender-status";

describe("tender-status vocabulary", () => {
  // ─── WON statuses ────────────────────────────────────────────────────────────
  it("WON_TENDER_STATUSES contains AWARDED, CONTRACT_ISSUED, CONVERTED", () => {
    expect(WON_TENDER_STATUSES.has("AWARDED")).toBe(true);
    expect(WON_TENDER_STATUSES.has("CONTRACT_ISSUED")).toBe(true);
    expect(WON_TENDER_STATUSES.has("CONVERTED")).toBe(true);
  });

  // ─── Won statuses are terminal and in history ─────────────────────────────────
  it("AWARDED is terminal and in history", () => {
    expect(TERMINAL_TENDER_STATUSES.has("AWARDED")).toBe(true);
    expect(HISTORY_TENDER_STATUSES.has("AWARDED")).toBe(true);
  });

  it("CONTRACT_ISSUED is terminal and in history", () => {
    expect(TERMINAL_TENDER_STATUSES.has("CONTRACT_ISSUED")).toBe(true);
    expect(HISTORY_TENDER_STATUSES.has("CONTRACT_ISSUED")).toBe(true);
  });

  it("CONVERTED is terminal and in history", () => {
    expect(TERMINAL_TENDER_STATUSES.has("CONVERTED")).toBe(true);
    expect(HISTORY_TENDER_STATUSES.has("CONVERTED")).toBe(true);
  });

  // ─── LOST is terminal and in history ─────────────────────────────────────────
  it("LOST is in LOST_TENDER_STATUSES, is terminal and in history", () => {
    expect(LOST_TENDER_STATUSES.has("LOST")).toBe(true);
    expect(TERMINAL_TENDER_STATUSES.has("LOST")).toBe(true);
    expect(HISTORY_TENDER_STATUSES.has("LOST")).toBe(true);
  });

  // ─── WITHDRAWN is terminal but NOT in history ─────────────────────────────────
  it("WITHDRAWN is terminal and NOT in history", () => {
    expect(TERMINAL_TENDER_STATUSES.has("WITHDRAWN")).toBe(true);
    expect(HISTORY_TENDER_STATUSES.has("WITHDRAWN")).toBe(false);
  });

  // ─── Active statuses are in neither set ──────────────────────────────────────
  it("DRAFT is in neither TERMINAL nor HISTORY", () => {
    expect(TERMINAL_TENDER_STATUSES.has("DRAFT")).toBe(false);
    expect(HISTORY_TENDER_STATUSES.has("DRAFT")).toBe(false);
  });

  it("IN_PROGRESS is in neither TERMINAL nor HISTORY", () => {
    expect(TERMINAL_TENDER_STATUSES.has("IN_PROGRESS")).toBe(false);
    expect(HISTORY_TENDER_STATUSES.has("IN_PROGRESS")).toBe(false);
  });

  it("SUBMITTED is in neither TERMINAL nor HISTORY", () => {
    expect(TERMINAL_TENDER_STATUSES.has("SUBMITTED")).toBe(false);
    expect(HISTORY_TENDER_STATUSES.has("SUBMITTED")).toBe(false);
  });

  // ─── Legacy values are terminal ───────────────────────────────────────────────
  it("legacy WON is in LEGACY_CLOSED_TENDER_STATUSES and is terminal", () => {
    expect(LEGACY_CLOSED_TENDER_STATUSES.has("WON")).toBe(true);
    expect(TERMINAL_TENDER_STATUSES.has("WON")).toBe(true);
  });

  it("legacy CLOSED is in LEGACY_CLOSED_TENDER_STATUSES and is terminal", () => {
    expect(LEGACY_CLOSED_TENDER_STATUSES.has("CLOSED")).toBe(true);
    expect(TERMINAL_TENDER_STATUSES.has("CLOSED")).toBe(true);
  });

  it("legacy NO_BID is in LEGACY_CLOSED_TENDER_STATUSES and is terminal", () => {
    expect(LEGACY_CLOSED_TENDER_STATUSES.has("NO_BID")).toBe(true);
    expect(TERMINAL_TENDER_STATUSES.has("NO_BID")).toBe(true);
  });

  // ─── Helper ───────────────────────────────────────────────────────────────────
  it("isTerminalTenderStatus returns true for terminal statuses", () => {
    expect(isTerminalTenderStatus("AWARDED")).toBe(true);
    expect(isTerminalTenderStatus("CONTRACT_ISSUED")).toBe(true);
    expect(isTerminalTenderStatus("CONVERTED")).toBe(true);
    expect(isTerminalTenderStatus("LOST")).toBe(true);
    expect(isTerminalTenderStatus("WITHDRAWN")).toBe(true);
    expect(isTerminalTenderStatus("WON")).toBe(true);
    expect(isTerminalTenderStatus("CLOSED")).toBe(true);
    expect(isTerminalTenderStatus("NO_BID")).toBe(true);
  });

  it("isTerminalTenderStatus returns false for open statuses", () => {
    expect(isTerminalTenderStatus("DRAFT")).toBe(false);
    expect(isTerminalTenderStatus("IN_PROGRESS")).toBe(false);
    expect(isTerminalTenderStatus("SUBMITTED")).toBe(false);
  });
});
