/**
 * B-HW-8: Auto-field safeguards for the handover wizard.
 *
 * Pure helpers used by HandoverWizardPage to enforce the one-way prefill
 * contract from the plan (`docs/plans/contract-handover-wizard-plan.md` §1.7):
 *
 * - {@link isEdited} — auto-field has been changed away from its prefilled source.
 * - {@link resetPatch} — build a PATCH item that restores the stored `sourceValue`.
 * - {@link detectSourceDrift} — diff two HandoverValue snapshots to find fields
 *   whose upstream (`sourceValue`) has changed since prefill; drives the
 *   pre-finalise "quote updated — re-sync?" prompt.
 * - {@link computeQuotedVsContractedVariance} — derive the read-only variance
 *   between awarded quote total and Contract.contractValue from the fields'
 *   current values. Never editable.
 *
 * Isolated from the page component so the logic is unit-testable in place
 * without touching React state.
 */
import type { HandoverField, HandoverValue, PatchValueItem } from "./handoverApi";

// ─── Auto-binding recognition ────────────────────────────────────────────────

/**
 * autoBinding paths (seeded in `handover-default-template.ts`) that identify
 * the quote-total and contract-value fields feeding the variance derivation.
 * Both historical spellings are accepted so the helper survives template edits.
 */
const QUOTE_TOTAL_BINDINGS = new Set([
  "awardedQuote.total",
  "quote.totalCost",
  "quote.total"
]);

const CONTRACT_VALUE_BINDINGS = new Set([
  "contract.contractValue"
]);

/**
 * True when a field is an auto-prefilled field whose auto-binding sources
 * from the awarded quote (as opposed to contract/project scalars). Used to
 * scope the drift check to quote-derived fields — the only ones that can
 * meaningfully change after prefill during the wizard's lifespan.
 */
export function isQuoteSourcedAutoField(field: HandoverField): boolean {
  if (field.sourceType !== "auto" || !field.autoBinding) return false;
  return (
    field.autoBinding.startsWith("quote.") ||
    field.autoBinding.startsWith("awardedQuote.")
  );
}

// ─── Edited / reset ──────────────────────────────────────────────────────────

/**
 * True when the auto-field has been edited away from its prefilled source.
 * Trusts the API's `isOverridden` flag when set; otherwise falls back to a
 * JSON compare against the stored `sourceValue` so an unsaved local edit is
 * caught before the next PATCH round-trip.
 */
export function isEdited(value: HandoverValue | undefined, currentDraft?: string): boolean {
  if (!value) return false;
  if (value.isOverridden) return true;
  if (value.sourceValue === null || value.sourceValue === undefined) return false;
  if (currentDraft === undefined) return false;
  return JSON.stringify(value.value) !== JSON.stringify(currentDraft) &&
    JSON.stringify(value.sourceValue) !== JSON.stringify(currentDraft);
}

/**
 * Build a PATCH item that resets a HandoverValue back to its prefilled
 * `sourceValue`. Returns null when the value has no source to reset to.
 */
export function resetPatch(value: HandoverValue): PatchValueItem | null {
  if (value.sourceValue === null || value.sourceValue === undefined) return null;
  return { fieldKey: value.fieldKey, value: value.sourceValue };
}

// ─── Source-drift detection ──────────────────────────────────────────────────

export type SourceDrift = {
  fieldKey: string;
  previousSource: unknown;
  currentSource: unknown;
};

/**
 * Compare two HandoverValue snapshots (previous vs freshly-fetched) and
 * return every quote-sourced auto-field whose upstream `sourceValue` has
 * shifted. When the API adds a "refresh sources" step before finalise (see
 * B-HW-11), this helper drives the "quote updated — re-sync?" prompt.
 */
export function detectSourceDrift(
  previous: HandoverValue[],
  current: HandoverValue[],
  fields: HandoverField[]
): SourceDrift[] {
  const previousMap = new Map(previous.map((v) => [v.fieldKey, v]));
  const drift: SourceDrift[] = [];
  const quoteKeys = new Set(fields.filter(isQuoteSourcedAutoField).map((f) => f.key));

  for (const curr of current) {
    if (!quoteKeys.has(curr.fieldKey)) continue;
    const prev = previousMap.get(curr.fieldKey);
    if (!prev) continue;
    if (JSON.stringify(prev.sourceValue) !== JSON.stringify(curr.sourceValue)) {
      drift.push({
        fieldKey: curr.fieldKey,
        previousSource: prev.sourceValue,
        currentSource: curr.sourceValue
      });
    }
  }
  return drift;
}

// ─── Derived variance ────────────────────────────────────────────────────────

export type QuotedVsContractedVariance = {
  quotedTotal: number;
  contractedValue: number;
  variance: number;
  variancePct: number | null;
};

/**
 * Coerce a HandoverValue's stored value to a number, defensive against the
 * value having been persisted as a string (auto-prefill of a Decimal comes
 * across as a number, but user edits arrive as strings from the input).
 */
function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Compute the quoted-vs-contracted variance from the current handover values.
 * Locates the two feed fields by their autoBinding (see
 * `QUOTE_TOTAL_BINDINGS` / `CONTRACT_VALUE_BINDINGS`) and returns a derived
 * read-only figure. Returns null when either input is missing so the caller
 * can hide the panel rather than render zeros.
 */
export function computeQuotedVsContractedVariance(
  fields: HandoverField[],
  values: HandoverValue[]
): QuotedVsContractedVariance | null {
  const valueMap = new Map(values.map((v) => [v.fieldKey, v]));

  const quoteField = fields.find(
    (f) => f.autoBinding !== null && QUOTE_TOTAL_BINDINGS.has(f.autoBinding)
  );
  const contractField = fields.find(
    (f) => f.autoBinding !== null && CONTRACT_VALUE_BINDINGS.has(f.autoBinding)
  );
  if (!quoteField || !contractField) return null;

  const quoted = toNumber(valueMap.get(quoteField.key)?.value);
  const contracted = toNumber(valueMap.get(contractField.key)?.value);
  if (quoted === null || contracted === null) return null;

  const variance = contracted - quoted;
  const variancePct = quoted === 0 ? null : (variance / quoted) * 100;

  return {
    quotedTotal: quoted,
    contractedValue: contracted,
    variance,
    variancePct
  };
}

// ─── Derived-field lock ──────────────────────────────────────────────────────

/**
 * Fields the wizard must not allow the user to edit directly: derived
 * (variance, computed rollups) and completion % are computed from other
 * state and are read-only per plan §1.7.
 */
export function isReadOnlyField(field: HandoverField): boolean {
  return field.sourceType === "derived";
}
