// crmvis-s6-bulk-link — CRM_PARITY_BULKLINK_V1 assertions.
//
// Spec:
//   1. Tile label "EXACT 1:1 MATCH" appears in the source.
//   2. Tile label "AMBIGUOUS" appears in the source.
//   3. Tile label "ALREADY LINKED" appears in the source.
//   4. Create button is disabled when ambiguousCount > 0 (existing guard pinned).
//   5. No 6-digit hex literal in AccountLinkPreview.tsx.
//   6. CRM_PARITY_BULKLINK_V1 marker is present.
//   7. "How the match works" panel heading appears (case-insensitive).
//   8. "crm-dialog" class appears (dialog structure).
//   9. "crm-dialog__footer" appears (pinned footer).
//  10. Create button label includes the word "Create".
//
// No jsdom — pure source-read tests, same pattern as crmvis-s5-followups.test.ts.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

const PAGE_SRC = readCrmSource("AccountLinkPreview.tsx");

// ── 1-3. Artboard tile labels ─────────────────────────────────────────────────

describe("AccountLinkPreview tile labels match artboard", () => {
  it("EXACT 1:1 MATCH label appears in source", () => {
    expect(PAGE_SRC).toContain("EXACT 1:1 MATCH");
  });

  it("AMBIGUOUS label appears in source", () => {
    expect(PAGE_SRC).toContain("AMBIGUOUS");
  });

  it("ALREADY LINKED label appears in source", () => {
    expect(PAGE_SRC).toContain("ALREADY LINKED");
  });
});

// ── 4. Create disabled when ambiguousCount > 0 ────────────────────────────────

describe("Create button disabled guard", () => {
  it("source contains the ambiguousCount > 0 disable guard on the Create button", () => {
    // The createDisabled variable or inline expression must mention ambiguousCount > 0
    expect(PAGE_SRC).toMatch(/ambiguousCount\s*>\s*0/);
  });

  it("the Create button uses the createDisabled expression", () => {
    // The button must be disabled= with createDisabled or the inline expression
    expect(PAGE_SRC).toMatch(/disabled=\{createDisabled\}/);
  });
});

// ── 5. No 6-digit hex literals ────────────────────────────────────────────────

describe("No 6-digit hex literals in AccountLinkPreview.tsx", () => {
  it("source contains no 6-digit hex literals", () => {
    const hexMatch = PAGE_SRC.match(/#[0-9a-fA-F]{6}\b/g);
    expect(hexMatch).toBeNull();
  });
});

// ── 6. CRM_PARITY_BULKLINK_V1 marker ─────────────────────────────────────────

describe("CRM_PARITY_BULKLINK_V1 marker", () => {
  it("marker is present in AccountLinkPreview.tsx", () => {
    expect(PAGE_SRC).toContain("CRM_PARITY_BULKLINK_V1");
  });
});

// ── 7. How the match works panel ─────────────────────────────────────────────

describe("How the match works panel", () => {
  it("HOW THE MATCH WORKS heading appears in source (artboard label)", () => {
    expect(PAGE_SRC.toUpperCase()).toContain("HOW THE MATCH WORKS");
  });
});

// ── 8-9. Dialog structure ────────────────────────────────────────────────────

describe("Dialog structure (crm-dialog classes)", () => {
  it("crm-dialog class appears in source", () => {
    expect(PAGE_SRC).toContain("crm-dialog");
  });

  it("crm-dialog__footer class appears in source (pinned footer)", () => {
    expect(PAGE_SRC).toContain("crm-dialog__footer");
  });
});

// ── 10. Create button label ──────────────────────────────────────────────────

describe("Create button label", () => {
  it("source contains a Create button label (not Commit)", () => {
    expect(PAGE_SRC).toContain("Create");
  });
});
