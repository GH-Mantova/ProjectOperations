/**
 * Canonical Tendering display-label keys and their in-code defaults.
 *
 * Kept in lockstep with apps/web/src/tendering-labels.ts. The API uses this
 * record to (a) reject unknown keys on PUT and (b) merge stored overrides
 * over the defaults on GET so the client always receives a full label map
 * even when nothing has been renamed yet.
 *
 * Labels are DISPLAY TEXT ONLY. Renaming a label never changes a database
 * key, enum value, route, or permission code.
 */
export const DEFAULT_TENDERING_LABELS = {
  // Tender register / detail — field labels
  "field.tenderNumber": "Tender number",
  "field.title": "Title",
  "field.description": "Description",
  "field.status": "Status",
  "field.probability": "Probability",
  "field.estimatedValue": "Estimated value",
  "field.dueDate": "Due date",
  "field.proposedStart": "Proposed start",
  "field.leadTimeDays": "Lead time (days)",
  "field.estimator": "Estimator",
  "field.linkedClients": "Linked clients",
  "field.contact": "Contact",
  "field.site": "Site",

  // Tender detail — tab labels
  "tab.scope": "Scope",
  "tab.quote": "Quote",
  "tab.rates": "Rates",
  "tab.history": "History",

  // Tender status display names — DB values stay unchanged; this is the
  // human-readable label rendered next to the raw enum string.
  "status.DRAFT": "Draft",
  "status.SUBMITTED": "Submitted",
  "status.AWARDED": "Awarded",
  "status.CONTRACT_ISSUED": "Contract issued",
  "status.CONVERTED": "Converted",
  "status.LOST": "Lost"
} as const;

export type TenderingLabelKey = keyof typeof DEFAULT_TENDERING_LABELS;

export function isTenderingLabelKey(value: string): value is TenderingLabelKey {
  return Object.prototype.hasOwnProperty.call(DEFAULT_TENDERING_LABELS, value);
}
