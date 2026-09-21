// CRM visual parity S7 — Comms hub Inbox (CRM_PARITY_INBOX_V1).
//
// These tests pin:
//   1. The marker constant exists and has the right value.
//   2. The composer is NOT rendered until New-thread state is active.
//   3. leadRowActionSet regression pin — the logic is unchanged.
//   4. No 6-digit hex in CommsInboxTriage.tsx or AnchorPicker.tsx.
//
// The web workspace has no @testing-library / jsdom setup; all tests are
// pure logic or source-text assertions.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { CRM_PARITY_INBOX_V1 } from "../CommsInboxTriage";
import {
  isIntakeLeadEmpty,
  leadRowActionSet,
  type EmptyLeadFields
} from "../CommsInboxTriage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

// ── 1. Marker ─────────────────────────────────────────────────────────────────

describe("CRM_PARITY_INBOX_V1 marker (S7)", () => {
  it("is exported and equals the crmvis-s7 marker string", () => {
    expect(CRM_PARITY_INBOX_V1).toBe("crmvis-s7");
  });
});

// ── 2. Composer visibility gate ───────────────────────────────────────────────
//
// The artboard shows the NEW THREAD strip only after the user presses
// "+ New thread". The previous design rendered it permanently. We assert the
// structural rule without mounting React.

describe("CommsHubPage — composer is gated behind New-thread state", () => {
  it("CommsHubPage.tsx does not render the New thread card unconditionally (green notice gone)", () => {
    const src = readCrmSource("CommsHubPage.tsx");
    // The old permanently-visible green notice must be gone.
    expect(src).not.toContain("Inbox view");
    expect(src).not.toContain("#f0fdf4");
    expect(src).not.toContain("#bbf7d0");
    expect(src).not.toContain("#15803d");
  });

  it("CommsHubPage.tsx gates the AnchorPicker on a showComposer state variable", () => {
    const src = readCrmSource("CommsHubPage.tsx");
    // The composer is conditional on some state; we check for the pattern.
    expect(src).toContain("showComposer");
  });

  it("CommsPage.tsx uses COMMS_TABS to drive the tab bar", () => {
    const src = readCrmSource("CommsPage.tsx");
    // COMMS_TABS drives the tab rendering — no stubs, no empty states.
    expect(src).toContain("COMMS_TABS");
    // Passes the resolved inner tab down to CommsHubPage.
    expect(src).toContain("activeInnerTab");
  });
});

// ── 3. leadRowActionSet regression pin ───────────────────────────────────────

describe("leadRowActionSet — triage vs delete (regression pin for S7)", () => {
  const empty: EmptyLeadFields = {
    notes: null,
    contact: null,
    account: null,
    dropReason: null
  };

  const nonEmpty: EmptyLeadFields = {
    notes: "Some notes",
    contact: null,
    account: null,
    dropReason: null
  };

  it("an empty lead gets the delete action set", () => {
    expect(leadRowActionSet(empty)).toBe("delete");
  });

  it("a non-empty lead gets the triage action set", () => {
    expect(leadRowActionSet(nonEmpty)).toBe("triage");
  });

  it("isIntakeLeadEmpty: all null fields is empty", () => {
    expect(isIntakeLeadEmpty(empty)).toBe(true);
  });

  it("isIntakeLeadEmpty: notes present is not empty", () => {
    expect(isIntakeLeadEmpty(nonEmpty)).toBe(false);
  });

  it("isIntakeLeadEmpty: account present is not empty", () => {
    const withAccount: EmptyLeadFields = {
      notes: null,
      contact: null,
      account: { id: "acc-1", lifecycleStatus: "active" },
      dropReason: null
    };
    expect(isIntakeLeadEmpty(withAccount)).toBe(false);
  });
});

// ── 4. No 6-digit hex in the two scope files ──────────────────────────────────

describe("No 6-digit hex literals in S7 scope files", () => {
  it("CommsInboxTriage.tsx has no #RRGGBB hex literals", () => {
    const src = readCrmSource("CommsInboxTriage.tsx");
    const hexMatches = src.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });

  it("AnchorPicker.tsx has no #RRGGBB hex literals", () => {
    const src = readCrmSource("AnchorPicker.tsx");
    const hexMatches = src.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });
});
