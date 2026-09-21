// crmvis-s5-followups — CRM_PARITY_FOLLOWUPS_V1 assertions.
//
// Spec:
//   1. The SHOW row renders the eight toggle labels in the artboard's order plus
//      Mine only (nine items total).
//   2. The KPI card for Overdue carries the danger stripe class.
//   3. The KPI card for Due this week carries the warning stripe class.
//   4. The KPI card for Never logged carries the neutral stripe class.
//   5. The KPI card for Value at risk carries the primary stripe class.
//   6. No 6-digit hex literal in TendersRegisterPage.tsx.
//   7. No hex literal in crm.css.
//   8. CRM_PARITY_FOLLOWUPS_V1 marker is present.
//   9. "Save this view" is present in the page source.
//  10. "What" appears in the page source (Follow-ups first column label).
//  11. The SHOW toggle row label is "SHOW" (artboard's uppercase label).
//
// No jsdom — pure source-read tests, same pattern as crmvis-s4-register.test.ts.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = resolve(__dirname, "..");

function readCrmSource(basename: string): string {
  return readFileSync(resolve(CRM_DIR, basename), "utf-8");
}

const PAGE_SRC = readCrmSource("TendersRegisterPage.tsx");
const CSS_SRC = readCrmSource("crm.css");

// ── 1. SHOW row toggle labels in artboard order ───────────────────────────────

describe("Follow-ups SHOW row — eight toggles in artboard order + Mine only", () => {
  // Artboard order: Overdue · Due soon · No next action · On track ·
  //                Submitted tenders · Opportunities · Leads · Won & lost ·
  //                Mine only
  // Note: entity-type labels come from ENTITY_TYPES.map() in the helpers and
  // are not literal strings in TendersRegisterPage.tsx.

  it("the four next-action toggle labels appear as literal text in the page source", () => {
    // Entity-type labels (Submitted tenders, Opportunities, Leads, Won & lost)
    // come from ENTITY_TYPES.map((def) => ... {def.label} ...) and are defined
    // in the helpers file, not as string literals in TendersRegisterPage.tsx.
    const literalLabels = ["Overdue", "Due soon", "No next action", "On track", "Mine only"] as const;
    for (const label of literalLabels) {
      expect(PAGE_SRC).toContain(label);
    }
  });

  it("the artboard order is preserved within the SHOW toggle row — literal labels appear in order", () => {
    // Extract the SHOW row section: between the crm-toggle-row marker and the
    // KPI grid that follows it. Entity-type labels come from ENTITY_TYPES.map()
    // and are not literal strings in the source; we check only the four
    // next-action labels (inline literals) and Mine only.
    const startMarker = "crm-toggle-row";
    const endMarker = "s7-card-grid--kpi";
    const startIdx = PAGE_SRC.indexOf(startMarker);
    const endIdx = PAGE_SRC.indexOf(endMarker, startIdx);
    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);
    const showSection = PAGE_SRC.slice(startIdx, endIdx);

    // The four next-action labels are inline JSX text — order is verifiable.
    const literalLabels = [
      "Overdue",
      "Due soon",
      "No next action",
      "On track"
    ] as const;

    const positions = literalLabels.map((label) => showSection.indexOf(label));
    for (let i = 0; i < literalLabels.length; i++) {
      expect(positions[i]).toBeGreaterThan(-1);
    }
    for (let i = 1; i < literalLabels.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    // Mine only appears after the next-action block (entity-types use map()).
    const mineOnlyPos = showSection.indexOf("Mine only");
    expect(mineOnlyPos).toBeGreaterThan(positions[positions.length - 1]);
  });

  it("entity-type toggles are rendered via ENTITY_TYPES.map() in the SHOW row", () => {
    // The four entity-type labels come from `{def.label}` — they are NOT
    // literal strings in the source. Verify the map() call is within the row.
    const startIdx = PAGE_SRC.indexOf("crm-toggle-row");
    const endIdx = PAGE_SRC.indexOf("s7-card-grid--kpi", startIdx);
    const showSection = PAGE_SRC.slice(startIdx, endIdx);
    // The entity-type map block renders def.label inside the row.
    expect(showSection).toContain("ENTITY_TYPES.map");
    expect(showSection).toContain("def.label");
  });

  it("the SHOW row carries the crm-toggle-row CSS class", () => {
    expect(PAGE_SRC).toContain("crm-toggle-row");
  });

  it("the SHOW label is the artboard's uppercase SHOW", () => {
    expect(PAGE_SRC).toContain("SHOW");
  });
});

// ── 2-5. KPI cards carry stripe classes ──────────────────────────────────────

describe("KPI cards — left stripe variant per artboard", () => {
  it("Overdue card carries crm-kpi--stripe-danger", () => {
    // The stripeVariant prop is passed as 'danger' for Overdue.
    expect(PAGE_SRC).toContain('stripeVariant="danger"');
  });

  it("Due this week card carries crm-kpi--stripe-warning", () => {
    expect(PAGE_SRC).toContain('stripeVariant="warning"');
  });

  it("Never logged card carries crm-kpi--stripe-neutral", () => {
    expect(PAGE_SRC).toContain('stripeVariant="neutral"');
  });

  it("Value at risk card carries crm-kpi--stripe-primary", () => {
    expect(PAGE_SRC).toContain('stripeVariant="primary"');
  });

  it("KpiCard renders the crm-kpi--stripe-<variant> class in markup", () => {
    // The KpiCard implementation composes `crm-kpi--stripe-${stripeVariant}`.
    expect(PAGE_SRC).toContain("crm-kpi--stripe-");
  });
});

// ── 6. No hex literal in page ─────────────────────────────────────────────────

describe("TendersRegisterPage.tsx — design-token compliance", () => {
  it("contains no 6-digit hex colour literal (#xxxxxx)", () => {
    const matches = PAGE_SRC.match(/#[0-9a-fA-F]{6}\b/g);
    expect(matches).toBeNull();
  });

  it("contains no 3-digit hex colour literal (#xxx)", () => {
    // Exclude false positives: #xxx that are part of a longer hex or id-like
    // string. Use a word-boundary approach consistent with done_when.
    const matches = PAGE_SRC.match(/#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g);
    expect(matches).toBeNull();
  });
});

// ── 7. No hex literal in crm.css ─────────────────────────────────────────────

describe("crm.css — design-token compliance", () => {
  it("contains no 6-digit hex colour literal", () => {
    const matches = CSS_SRC.match(/#[0-9a-fA-F]{6}\b/g);
    expect(matches).toBeNull();
  });

  it("contains no 3-digit hex colour literal", () => {
    const matches = CSS_SRC.match(/#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g);
    expect(matches).toBeNull();
  });
});

// ── 8. Marker present ─────────────────────────────────────────────────────────

describe("CRM_PARITY_FOLLOWUPS_V1 marker", () => {
  it("is present in TendersRegisterPage.tsx", () => {
    expect(PAGE_SRC).toContain("CRM_PARITY_FOLLOWUPS_V1");
  });

  it("is set to crmvis-s5", () => {
    expect(PAGE_SRC).toContain('CRM_PARITY_FOLLOWUPS_V1 = "crmvis-s5"');
  });
});

// ── 9. Save this view ─────────────────────────────────────────────────────────

describe("Follow-ups head actions", () => {
  it("'Save this view' is present in the page source", () => {
    expect(PAGE_SRC).toContain("Save this view");
  });

  it("'Export CSV' is present in the page source", () => {
    expect(PAGE_SRC).toContain("Export CSV");
  });
});

// ── 10. First column "What" for Follow-ups ────────────────────────────────────

describe("Follow-ups table — first column label", () => {
  it("the page renders 'What' as the column label on Follow-ups", () => {
    // The colLabel override: `tab === "followups" && col.id === "tender" ? "What" : col.label`
    expect(PAGE_SRC).toContain('"What"');
  });
});

// ── 11. Toggle row CSS class present in crm.css ───────────────────────────────

describe("crm.css — S5 classes present", () => {
  it("defines .crm-toggle-row", () => {
    expect(CSS_SRC).toContain(".crm-toggle-row");
  });

  it("defines .crm-toggle (base pill)", () => {
    expect(CSS_SRC).toContain(".crm-toggle {");
  });

  it("defines .crm-toggle--on (filled state)", () => {
    expect(CSS_SRC).toContain(".crm-toggle--on");
  });

  it("defines .crm-dot--danger", () => {
    expect(CSS_SRC).toContain(".crm-dot--danger");
  });

  it("defines .crm-dot--warning", () => {
    expect(CSS_SRC).toContain(".crm-dot--warning");
  });

  it("defines .crm-dot--neutral", () => {
    expect(CSS_SRC).toContain(".crm-dot--neutral");
  });

  it("defines .crm-dot--active", () => {
    expect(CSS_SRC).toContain(".crm-dot--active");
  });

  it("defines .crm-kpi--stripe-danger", () => {
    expect(CSS_SRC).toContain(".crm-kpi--stripe-danger");
  });

  it("defines .crm-kpi--stripe-warning", () => {
    expect(CSS_SRC).toContain(".crm-kpi--stripe-warning");
  });

  it("defines .crm-kpi--stripe-neutral", () => {
    expect(CSS_SRC).toContain(".crm-kpi--stripe-neutral");
  });

  it("defines .crm-kpi--stripe-primary", () => {
    expect(CSS_SRC).toContain(".crm-kpi--stripe-primary");
  });
});
