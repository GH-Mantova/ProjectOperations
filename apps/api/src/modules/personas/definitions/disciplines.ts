/**
 * IS discipline codes — the canonical 4-code system.
 *
 * Migration history (2026-05-16, PR A1):
 *   - SO  (Strip-outs)    -> DEM
 *   - Str (Structural)    -> DEM
 *   - Asb (Asbestos)      -> ASB
 *   - Civ (Civil)         -> CIV
 *   - Prv (Provisional)   -> Other
 *
 * "Other" is intentionally broader than just provisional sums -- it also
 * catches cost options, adjustments, and anything that doesn't fit
 * DEM/CIV/ASB. The user names their own scope cards in PR B1+; this
 * 5-code system is the discipline TAG on each card, not the card's
 * identity.
 *
 * "SUB" (scope-subcontracted, added 2026-08-31) holds work handed to a
 * subcontractor, priced against the quote received. SUB is inside the
 * grandTotal (not provisional); individual lines carry their own manpower
 * and plant pricing via the standard labour-rate path.
 *
 * Every consumer of discipline codes must import from this file. Do not
 * inline literals elsewhere -- the source of truth is here.
 */

export const IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other", "SUB"] as const;
export type IsDisciplineCode = (typeof IS_DISCIPLINE_CODES)[number];

export const IS_DISCIPLINE_LABELS: Record<IsDisciplineCode, string> = {
  DEM: "Demolition",
  CIV: "Civil",
  ASB: "Asbestos",
  SUB: "Subcontracted",
  Other: "Other"
};

export const IS_DISCIPLINE_DESCRIPTIONS: Record<IsDisciplineCode, string> = {
  DEM:
    "Demolition -- covers both internal non-structural strip-outs and " +
    "structural demolition. Strip-outs include removal of internal walls, " +
    "ceilings, floor finishes, joinery, MEP fixtures during fit-out " +
    "preparation. Structural demolition includes load-bearing walls, slabs, " +
    "columns, beams, facades, often involving engineered demolition methods. " +
    "IMPORTANT: 'strip-out' in IS context means REMOVING existing fit-outs " +
    "(NOT installing new fit-outs -- installation is out of scope).",
  CIV:
    "Civil works -- earthworks, drainage, concrete works, demolition " +
    "preparation. Includes civil drainage (stormwater, sewer infrastructure), " +
    "site remediation, pavement removal/replacement. NOT plumbing or " +
    "hydraulic services. NOT new concrete construction.",
  ASB:
    "Asbestos removal -- Class A (friable) and Class B (non-friable / bonded) " +
    "ACM removal, including enclosures, air monitoring, clearances. When " +
    "asbestos is in scope, you MUST cross-reference the asbestos register " +
    "before proposing any ASB scope items.",
  SUB:
    "Subcontracted -- work handed to a subcontractor, priced against the " +
    "quote received. SUB lines are inside the grand total (not provisional). " +
    "A linked WBS item stops carrying its own manpower and plant into the " +
    "price and shows 'priced on SUBx.x' in its place so the same work is " +
    "never counted twice.",
  Other:
    "Other -- provisional sums, cost options, adjustments, allowances, and " +
    "anything that doesn't fit DEM/CIV/ASB/SUB. Used for PS items where extent " +
    "or pricing is uncertain at tender time."
};

/**
 * Legacy discipline code mapping. Use to remap historical data ONLY.
 * Do not use these codes in new code.
 */
export const LEGACY_DISCIPLINE_MIGRATION_MAP: Record<string, IsDisciplineCode> = {
  SO: "DEM",
  Str: "DEM",
  Asb: "ASB",
  Civ: "CIV",
  Prv: "Other"
};

/**
 * Lowercase / word-form mapping used by the older propose_scope_items tool
 * (pre-PR-A1 vocabulary). Do not use in new code.
 */
export const LEGACY_LOWERCASE_DISCIPLINE_MAP: Record<string, IsDisciplineCode> = {
  demolition: "DEM",
  asbestos: "ASB",
  civil: "CIV"
};
