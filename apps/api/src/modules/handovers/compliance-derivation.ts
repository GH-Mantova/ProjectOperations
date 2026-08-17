// B-HW-9: Pure compliance-obligation derivation logic.
//
// `deriveComplianceSuggestions` is a zero-dependency, zero-I/O function that
// maps an array of scope-of-works items to a list of suggested compliance
// obligations.  The caller (HandoverComplianceService) is responsible for
// persisting these suggestions; this module only does the derivation.
//
// Heuristics (from B-HW-9 §1 decision 8 / §4):
//  - Any scope item present     → "SWMS — General site works" (us)
//  - asbestos/asbestos-removal  → Form 65 (asbestos) + SWMS + licence (us)
//  - demolition                 → Form 65 (demolition) + SWMS + permit (us)
//  - excavation/earthworks      → SWMS + Service disconnection cert + DBYD (us)
//  - cutting                    → SWMS — Concrete cutting (us)
//
// De-duplication is by `type` string (case-insensitive), preserving the order
// of first appearance.

import type { HandoverOrigin } from "./handover.types";

// ── Origin constants ──────────────────────────────────────────────────────────

export const SUGGESTION_ORIGIN: HandoverOrigin = "suggested";
export const MANUAL_ORIGIN: HandoverOrigin = "manual";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ScopeItemInput {
  rowType: string;
  discipline: string;
  description?: string;
}

export interface ComplianceSuggestion {
  type: string;
  responsibleParty: "us" | "client";
}

// ── Derivation function ───────────────────────────────────────────────────────

/**
 * Derive compliance-obligation suggestions from a list of scope items.
 *
 * The function is pure and has no side effects.  Results are de-duplicated by
 * `type` (case-insensitive) in order of first appearance.
 *
 * @param scopeItems - Array of scope-of-works items to analyse.
 * @returns Ordered, de-duplicated array of compliance suggestions.
 */
export function deriveComplianceSuggestions(
  scopeItems: ScopeItemInput[],
  // headerContext is reserved for future expansion (e.g. council area, site
  // class) and intentionally unused in this baseline implementation.
  _headerContext?: Record<string, unknown>
): ComplianceSuggestion[] {
  if (scopeItems.length === 0) {
    return [];
  }

  const candidates: ComplianceSuggestion[] = [];

  // Baseline: any scope item present → general SWMS.
  candidates.push({ type: "SWMS — General site works", responsibleParty: "us" });

  for (const item of scopeItems) {
    const rt = item.rowType.toLowerCase();
    const disc = item.discipline.toUpperCase();

    // Asbestos
    if (rt === "asbestos" || rt === "asbestos-removal" || disc === "ASB") {
      candidates.push({ type: "Form 65 — Asbestos", responsibleParty: "us" });
      candidates.push({ type: "SWMS — Asbestos handling", responsibleParty: "us" });
      candidates.push({ type: "Asbestos removal licence", responsibleParty: "us" });
    }

    // Demolition
    if (rt === "demolition" || disc === "DEM") {
      candidates.push({ type: "Form 65 — Demolition", responsibleParty: "us" });
      candidates.push({ type: "SWMS — Demolition", responsibleParty: "us" });
      candidates.push({ type: "Demolition permit", responsibleParty: "us" });
    }

    // Excavation / earthworks
    if (rt === "excavation" || rt === "earthworks" || disc === "CIV") {
      candidates.push({ type: "SWMS — Excavation", responsibleParty: "us" });
      candidates.push({ type: "Service disconnection certificate", responsibleParty: "us" });
      candidates.push({ type: "Dial Before You Dig", responsibleParty: "us" });
    }

    // Cutting
    if (rt === "cutting") {
      candidates.push({ type: "SWMS — Concrete cutting", responsibleParty: "us" });
    }
  }

  // De-duplicate by type (case-insensitive), preserving first-appearance order.
  const seen = new Set<string>();
  const result: ComplianceSuggestion[] = [];
  for (const candidate of candidates) {
    const key = candidate.type.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(candidate);
    }
  }

  return result;
}
