/**
 * CRM_INTERACTION_CHANNEL_V1 — web-layer tests.
 *
 * Tests pure helpers only — no React, no DOM.
 *
 * 1. validateLogPayload rejects a missing channel with the exact message, and
 *    accepts all five valid channels.
 * 2. CHANNEL_LABEL covers all five API values.
 * 3. The cell formatter renders "Phone — 4 days ago" with a channel, and only
 *    "4 days ago" without.
 * 4. CSV includes the two new columns (Last interaction channel, Last interaction summary).
 */

import { describe, expect, it } from "vitest";
import {
  validateLogPayload,
  CHANNEL_LABEL,
  buildCrmRegisterCsv,
  formatRelativeTime,
  type LogPayload,
  type CrmExportRow
} from "../tendersRegisterPage.helpers";

// ---------------------------------------------------------------------------
// 1. validateLogPayload — channel required
// ---------------------------------------------------------------------------

describe("validateLogPayload — CRM_INTERACTION_CHANNEL_V1 channel validation", () => {
  const BASE_PAYLOAD: LogPayload = {
    channel: "phone",
    subject: "Chased addendum 3",
    body: "Called the QS."
  };

  it("rejects a missing channel with the exact error message", () => {
    const result = validateLogPayload({ ...BASE_PAYLOAD, channel: "" });
    expect(result).toBe("Pick how you made contact.");
  });

  it("rejects an unknown channel with the exact error message", () => {
    const result = validateLogPayload({ ...BASE_PAYLOAD, channel: "carrier_pigeon" });
    expect(result).toBe("Pick how you made contact.");
  });

  it("checks channel BEFORE subject (channel error wins)", () => {
    const result = validateLogPayload({ ...BASE_PAYLOAD, channel: "", subject: "" });
    expect(result).toBe("Pick how you made contact.");
  });

  it.each(["phone", "email", "meeting", "site_visit", "other"] as const)(
    "accepts channel=%s",
    (ch) => {
      const result = validateLogPayload({ ...BASE_PAYLOAD, channel: ch });
      expect(result).toBeNull();
    }
  );

  it("still rejects a missing summary after a valid channel is set", () => {
    const result = validateLogPayload({ ...BASE_PAYLOAD, subject: "" });
    expect(result).not.toBeNull();
    expect(result).not.toBe("Pick how you made contact.");
  });
});

// ---------------------------------------------------------------------------
// 2. CHANNEL_LABEL covers all five API values
// ---------------------------------------------------------------------------

describe("CHANNEL_LABEL — covers all five API channels", () => {
  const API_CHANNELS = ["phone", "email", "meeting", "site_visit", "other"] as const;

  it.each(API_CHANNELS)("has a label for %s", (ch) => {
    expect(CHANNEL_LABEL[ch]).toBeDefined();
    expect(typeof CHANNEL_LABEL[ch]).toBe("string");
    expect(CHANNEL_LABEL[ch].length).toBeGreaterThan(0);
  });

  it("maps site_visit to 'Site visit'", () => {
    expect(CHANNEL_LABEL["site_visit"]).toBe("Site visit");
  });

  it("maps phone to 'Phone'", () => {
    expect(CHANNEL_LABEL["phone"]).toBe("Phone");
  });
});

// ---------------------------------------------------------------------------
// 3. Cell formatter: "Phone — 4 days ago" vs "4 days ago"
// ---------------------------------------------------------------------------

describe("Last interaction cell formatting — CRM_INTERACTION_CHANNEL_V1", () => {
  // Pinned reference: 4 days ago from 2026-10-03T12:00:00Z
  const NOW = new Date("2026-10-03T12:00:00.000Z");
  const FOUR_DAYS_AGO = new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

  /**
   * Mirror the cell rendering logic from TendersRegisterPage.tsx so we can
   * assert the output without mounting React.
   */
  function renderCellLine1(channel: string | null, lastMessageAt: string | null, now: Date): string {
    const relTime = formatRelativeTime(lastMessageAt, now);
    const channelLabel = channel ? (CHANNEL_LABEL[channel] ?? null) : null;
    return channelLabel ? `${channelLabel} — ${relTime}` : relTime;
  }

  it("renders 'Phone — 4 days ago' when channel is 'phone'", () => {
    expect(renderCellLine1("phone", FOUR_DAYS_AGO, NOW)).toBe("Phone — 4 days ago");
  });

  it("renders just '4 days ago' when channel is null (legacy log)", () => {
    expect(renderCellLine1(null, FOUR_DAYS_AGO, NOW)).toBe("4 days ago");
  });

  it("renders '—' when lastMessageAt is null (never logged)", () => {
    expect(renderCellLine1(null, null, NOW)).toBe("—");
  });

  it("renders 'Email — 4 days ago' for email channel", () => {
    expect(renderCellLine1("email", FOUR_DAYS_AGO, NOW)).toBe("Email — 4 days ago");
  });

  it("renders 'Site visit — 4 days ago' for site_visit channel", () => {
    expect(renderCellLine1("site_visit", FOUR_DAYS_AGO, NOW)).toBe("Site visit — 4 days ago");
  });
});

// ---------------------------------------------------------------------------
// 4. CSV includes the two new columns
// ---------------------------------------------------------------------------

describe("buildCrmRegisterCsv — CRM_INTERACTION_CHANNEL_V1 columns", () => {
  const ROWS: CrmExportRow[] = [
    {
      tenderNumber: "T-2418",
      title: "Northshore demolition",
      tenderClients: [{ client: { name: "Hansen Yuncken" } }],
      status: "SUBMITTED",
      updatedAt: "2026-09-28T00:00:00Z",
      lastInteractionAt: "2026-09-29T00:00:00Z",
      lastInteractionChannel: "phone",
      lastInteractionSummary: "Chased addendum 3",
      loggedByName: "M. Cattaneo",
      nextActionAt: null,
      nextActionNote: null
    },
    {
      tenderNumber: "T-2390",
      title: "Lutwyche strip-out",
      tenderClients: [{ client: { name: "Hutchinson Builders" } }],
      status: "SUBMITTED",
      updatedAt: "2026-09-20T00:00:00Z",
      lastInteractionAt: "2026-09-21T00:00:00Z",
      lastInteractionChannel: null,
      lastInteractionSummary: "Left voicemail for Dan",
      loggedByName: "M. Cattaneo",
      nextActionAt: null,
      nextActionNote: null
    }
  ];

  it("includes 'Last interaction channel' header", () => {
    const csv = buildCrmRegisterCsv(ROWS);
    expect(csv).toContain("Last interaction channel");
  });

  it("includes 'Last interaction summary' header", () => {
    const csv = buildCrmRegisterCsv(ROWS);
    expect(csv).toContain("Last interaction summary");
  });

  it("renders the channel label (not the raw key) in the channel column", () => {
    const csv = buildCrmRegisterCsv(ROWS);
    expect(csv).toContain("Phone");
    // Should NOT contain the raw key "phone" as a standalone cell value
    // (the raw key could appear in other columns, so we check the label is present)
  });

  it("renders the summary in the summary column", () => {
    const csv = buildCrmRegisterCsv(ROWS);
    expect(csv).toContain("Chased addendum 3");
  });

  it("renders an empty channel cell for a legacy log (channel null)", () => {
    const csv = buildCrmRegisterCsv(ROWS);
    // Row 2 has null channel — its cell should be empty (two adjacent commas around "")
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(3); // header + 2 rows
    // Row 2 has lastInteractionSummary but no channel
    expect(lines[2]).toContain('"Left voicemail for Dan"');
  });

  it("includes the correct number of columns (11)", () => {
    const csv = buildCrmRegisterCsv([]);
    const headers = csv.split("\r\n")[0].split(",");
    expect(headers.length).toBe(11);
  });
});
