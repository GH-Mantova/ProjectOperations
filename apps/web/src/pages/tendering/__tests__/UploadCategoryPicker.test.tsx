/**
 * TFM-S4: Unit tests for UploadCategoryPicker logic.
 *
 * No jsdom in this workspace — rendering behaviour is exercised via the
 * smoke checklist in the PR body. These specs cover the pure tree-building
 * and path-derivation logic exported from UploadCategoryPicker.tsx.
 */
import { describe, expect, it } from "vitest";
import {
  buildEffectiveNodes,
  collectLeafPaths,
  labelFor
} from "../UploadCategoryPicker";
import { TENDER_FOLDER_STRUCTURE } from "../../../lib/document-categories";

describe("labelFor", () => {
  it("returns the last segment for a single-segment path", () => {
    expect(labelFor("7. Other")).toBe("7. Other");
  });

  it("returns the last segment for a multi-segment path", () => {
    expect(labelFor("1. Plans, Scopes & Specs/01. Drawings")).toBe("01. Drawings");
  });

  it("handles Quotes/{client} paths", () => {
    expect(labelFor("Quotes/Acme Corp")).toBe("Acme Corp");
  });
});

describe("buildEffectiveNodes — tree structure", () => {
  it("includes all top-level paths from TENDER_FOLDER_STRUCTURE", () => {
    const nodes = buildEffectiveNodes([]);
    const topPaths = nodes.map((n) => n.path);
    expect(topPaths).toContain("1. Plans, Scopes & Specs");
    expect(topPaths).toContain("7. Other");
    expect(topPaths).toContain("Quotes");
  });

  it("preserves children from TENDER_FOLDER_STRUCTURE for non-Quotes nodes", () => {
    const nodes = buildEffectiveNodes([]);
    const plansNode = nodes.find((n) => n.path === "1. Plans, Scopes & Specs");
    expect(plansNode?.children?.map((c) => c.path)).toContain(
      "1. Plans, Scopes & Specs/01. Drawings"
    );
    expect(plansNode?.children?.map((c) => c.path)).toContain(
      "1. Plans, Scopes & Specs/04. As Builts"
    );
  });

  it("Quotes node has no children when tenderClients is empty", () => {
    const nodes = buildEffectiveNodes([]);
    const quotesNode = nodes.find((n) => n.path === "Quotes");
    expect(quotesNode?.children).toEqual([]);
  });

  it("Quotes node expands to per-client children when clients provided", () => {
    const clients = [
      { id: "c1", name: "Acme Corp" },
      { id: "c2", name: "Northshore Builders" }
    ];
    const nodes = buildEffectiveNodes(clients);
    const quotesNode = nodes.find((n) => n.path === "Quotes");
    expect(quotesNode?.children?.map((c) => c.path)).toEqual([
      "Quotes/Acme Corp",
      "Quotes/Northshore Builders"
    ]);
  });

  it("each client child path is prefixed with 'Quotes/'", () => {
    const clients = [{ id: "c1", name: "Delta Civils" }];
    const nodes = buildEffectiveNodes(clients);
    const quotesNode = nodes.find((n) => n.path === "Quotes");
    const childPath = quotesNode?.children?.[0]?.path;
    expect(childPath).toBe("Quotes/Delta Civils");
  });
});

describe("collectLeafPaths — selectable paths", () => {
  it("returns leaf paths only (nodes with no children)", () => {
    const nodes = buildEffectiveNodes([]);
    const leaves = collectLeafPaths(nodes);
    // 1. Plans... has 4 children (leaves) — parent itself is not a leaf.
    expect(leaves).not.toContain("1. Plans, Scopes & Specs");
    expect(leaves).toContain("1. Plans, Scopes & Specs/01. Drawings");
    expect(leaves).toContain("1. Plans, Scopes & Specs/04. As Builts");
  });

  it("includes Quotes as a leaf when no clients are provided", () => {
    const leaves = collectLeafPaths(buildEffectiveNodes([]));
    // Quotes has empty children array, so it IS a leaf (catch-all).
    expect(leaves).toContain("Quotes");
  });

  it("replaces Quotes with per-client leaves when clients are provided", () => {
    const clients = [
      { id: "c1", name: "Acme Corp" },
      { id: "c2", name: "Northshore Builders" }
    ];
    const leaves = collectLeafPaths(buildEffectiveNodes(clients));
    expect(leaves).not.toContain("Quotes");
    expect(leaves).toContain("Quotes/Acme Corp");
    expect(leaves).toContain("Quotes/Northshore Builders");
  });

  it("3. Estimates & Calcs/Superseded is a leaf, its parent is not", () => {
    const leaves = collectLeafPaths(buildEffectiveNodes([]));
    expect(leaves).not.toContain("3. Estimates & Calcs");
    expect(leaves).toContain("3. Estimates & Calcs/Superseded");
  });
});

describe("TENDER_FOLDER_STRUCTURE contract", () => {
  it("contains exactly the expected top-level paths in order", () => {
    const topPaths = TENDER_FOLDER_STRUCTURE.map((n) => n.path);
    expect(topPaths).toEqual([
      "1. Plans, Scopes & Specs",
      "2. Photos",
      "3. Estimates & Calcs",
      "4. Suppliers",
      "5. Compliance, WHS & Asbestos",
      "6. Correspondence",
      "7. Other",
      "Quotes"
    ]);
  });

  it("1. Plans, Scopes & Specs has exactly 4 children", () => {
    const node = TENDER_FOLDER_STRUCTURE.find((n) => n.path === "1. Plans, Scopes & Specs");
    expect(node?.children).toHaveLength(4);
  });
});
