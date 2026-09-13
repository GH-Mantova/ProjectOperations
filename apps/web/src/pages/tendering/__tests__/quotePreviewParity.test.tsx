// QPDF-4 — quotePreviewParity.test.tsx
//
// Asserts that PreviewTab's cost-line map matches what quote-pdf.service.ts
// sends to the renderer on three axes:
//
//   1. Hidden lines (isVisible=false) — filtered OUT in both preview and PDF
//   2. Amount — approp.displayedAmount when an appropriation exists; l.price otherwise
//   3. Description — l.displayDescription when set; l.description otherwise
//
// The web workspace has no jsdom / @testing-library. The test follows the
// source-read pattern used in waste-section.test.tsx: for DOM-shape claims we
// read the source file and grep for the exact patterns.
//
// Pure-logic claims (the mapping computation itself) are tested by executing
// the equivalent inline logic, identical to what we put in the JSX.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const previewSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ClientQuotesPanel.tsx"),
  "utf-8"
);

const pdfServiceSource = readFileSync(
  repoFile("apps/api/src/modules/client-quotes/quote-pdf.service.ts"),
  "utf-8"
);

// ── Source-code structural assertions ────────────────────────────────────────

describe("PreviewTab source parity with quote-pdf.service.ts (QPDF-4)", () => {
  it("preview filters cost lines by isVisible (same as PDF .filter((l) => l.isVisible))", () => {
    // The preview must filter isVisible. Check for the filter expression in the
    // PreviewTab cost lines render block.
    expect(previewSource).toMatch(/costLines\.filter\(\(l\)\s*=>\s*l\.isVisible\)/);
  });

  it("PDF service also filters cost lines by isVisible", () => {
    expect(pdfServiceSource).toMatch(/\.filter\(\(l\)\s*=>\s*l\.isVisible\)/);
  });

  it("preview uses displayedAmount from appropriation (same as PDF)", () => {
    // Both preview and PDF must look up lineAppropriations and use displayedAmount.
    expect(previewSource).toMatch(/approp\.displayedAmount/);
    expect(pdfServiceSource).toMatch(/approp\s*\?\s*approp\.displayedAmount/);
  });

  it("preview uses displayDescription with description fallback (same as PDF)", () => {
    // Preview must fall back: displayDescription ?? description
    expect(previewSource).toMatch(/displayDescription\s*\?\?\s*l\.description/);
    // PDF uses l.displayDescription field directly in the costLine map
    expect(pdfServiceSource).toMatch(/displayDescription:\s*l\.displayDescription/);
  });

  it("preview finds appropriation via lineAppropriations.find(a => a.lineId === l.id)", () => {
    // Same lookup pattern as the editor and the PDF service
    expect(previewSource).toMatch(/lineAppropriations\?\.find\(\(a\)\s*=>\s*a\.lineId\s*===\s*l\.id\)/);
  });

  it("preview does not contain any hex literals (uses CSS var tokens only)", () => {
    // Grep for new hex colour literals added by this PR (not pre-existing ones
    // in the file). We check that no hex was added inside the PreviewTab block
    // specifically around the cost lines we changed.
    // A simple approach: the patched block (filter+map) contains no new hex.
    const patchedBlock = previewSource.slice(
      previewSource.indexOf("costLines.filter((l) => l.isVisible)"),
      previewSource.indexOf("</ul>", previewSource.indexOf("costLines.filter((l) => l.isVisible)")) + 6
    );
    // This block should contain no inline hex colour literals (#rrggbb)
    const hexLiterals = [...patchedBlock.matchAll(/#[0-9a-fA-F]{3,8}(?=[^;]|$)/g)]
      .map((m) => m[0]);
    expect(hexLiterals).toHaveLength(0);
  });
});

// ── Pure-logic assertions (the mapping computation) ──────────────────────────

type CostLine = {
  id: string;
  label: string;
  description: string;
  displayDescription: string | null;
  price: string;
  isVisible: boolean;
};
type LineAppropriation = { lineId: string; displayedAmount: number };

/** Replicates the mapping logic from PreviewTab's cost lines render block. */
function mapPreviewLines(
  costLines: CostLine[],
  lineAppropriations: LineAppropriation[] | undefined
): Array<{ id: string; label: string; displayDesc: string; displayAmount: string | number }> {
  return costLines.filter((l) => l.isVisible).map((l) => {
    const approp = lineAppropriations?.find((a) => a.lineId === l.id);
    const displayAmount = approp ? approp.displayedAmount : l.price;
    const displayDesc = l.displayDescription ?? l.description;
    return { id: l.id, label: l.label, displayDesc, displayAmount };
  });
}

describe("PreviewTab cost-line mapping logic (QPDF-4)", () => {
  const lines: CostLine[] = [
    {
      id: "l1",
      label: "A",
      description: "Demolition",
      displayDescription: "Client-facing demolition",
      price: "1000.00",
      isVisible: true
    },
    {
      id: "l2",
      label: "B",
      description: "Hidden work",
      displayDescription: null,
      price: "500.00",
      isVisible: false  // hidden — should not appear
    },
    {
      id: "l3",
      label: "C",
      description: "Civil works",
      displayDescription: null,
      price: "2000.00",
      isVisible: true
    }
  ];

  const appropriations: LineAppropriation[] = [
    { lineId: "l1", displayedAmount: 1200 },   // overrides l1's price
    // l3 has no appropriation — falls back to l3.price
  ];

  it("hidden line (isVisible=false) is absent from the output", () => {
    const result = mapPreviewLines(lines, appropriations);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain("l2");
    expect(ids).toHaveLength(2);
  });

  it("appropriated line shows displayedAmount not price", () => {
    const result = mapPreviewLines(lines, appropriations);
    const l1 = result.find((r) => r.id === "l1")!;
    expect(l1.displayAmount).toBe(1200);    // displayedAmount, not "1000.00"
    expect(l1.displayAmount).not.toBe("1000.00");
  });

  it("line without appropriation shows price", () => {
    const result = mapPreviewLines(lines, appropriations);
    const l3 = result.find((r) => r.id === "l3")!;
    expect(l3.displayAmount).toBe("2000.00");  // raw price
  });

  it("line with displayDescription shows displayDescription, not description", () => {
    const result = mapPreviewLines(lines, appropriations);
    const l1 = result.find((r) => r.id === "l1")!;
    expect(l1.displayDesc).toBe("Client-facing demolition");
    expect(l1.displayDesc).not.toBe("Demolition");
  });

  it("line without displayDescription (null) falls back to description", () => {
    const result = mapPreviewLines(lines, appropriations);
    const l3 = result.find((r) => r.id === "l3")!;
    expect(l3.displayDesc).toBe("Civil works");
  });

  it("when lineAppropriations is undefined, falls back to price for all lines", () => {
    const result = mapPreviewLines(lines, undefined);
    const visible = result.filter((r) => true); // all visible ones
    expect(visible).toHaveLength(2);
    const l1 = result.find((r) => r.id === "l1")!;
    expect(l1.displayAmount).toBe("1000.00");
  });
});
