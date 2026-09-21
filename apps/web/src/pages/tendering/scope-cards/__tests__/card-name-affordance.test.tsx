// SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — pencil glyph affordance
// on the CardNameHeading component in ScopeCardsTab.
//
// Source assertions only (no DOM, no AuthProvider needed for source checks).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const scopeCardsTabSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
  "utf-8"
);

describe("CardNameHeading — pencil affordance (S3)", () => {
  it("pencil glyph ✎ (&#9998;) is in the component source", () => {
    expect(scopeCardsTabSource).toContain("&#9998;");
  });

  it("aria-hidden is applied to the glyph span", () => {
    expect(scopeCardsTabSource).toContain('aria-hidden="true"');
  });

  it("aria-label 'Rename card' is on the button wrapper", () => {
    expect(scopeCardsTabSource).toContain('"Rename card"');
  });

  it("title 'Double-click to rename' is retained", () => {
    expect(scopeCardsTabSource).toContain('"Double-click to rename"');
  });

  it("pencil button has card-name-rename-btn class for hover/focus CSS", () => {
    expect(scopeCardsTabSource).toContain("card-name-rename-btn");
  });

  it("click opens editor — same handler as double-click (setEditing(true))", () => {
    // Both onClick and onDoubleClick call setEditing(true)
    const occurrences = (scopeCardsTabSource.match(/setEditing\(true\)/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
