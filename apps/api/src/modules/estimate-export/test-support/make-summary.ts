import type { ExportPayload } from "../estimate-export.service";

/**
 * One place that knows the shape of ExportPayload["summary"].
 *
 * Before this existed, two specs hand-built that literal and it broke three
 * times running as the type gained fields - "SUB" (#1443), then
 * provisionalSubtotal / provisionalWithMarkup / provisionalTotal (#1471).
 * Each time the failure was TS2739 or TS2741 in a file no prompt's scope list
 * mentions, so it surfaced as a red CI run on an unrelated PR.
 *
 * The point is the RETURN TYPE. Because this function is annotated as
 * Summary, adding a field to ExportPayload["summary"] breaks exactly one file
 * - this one - and the fix is one default. Do not remove the annotation to
 * silence a compile error; that error is the helper doing its job.
 */
type Summary = ExportPayload["summary"];
type DisciplineBucket = Summary["DEM"];

function zeroBucket(): DisciplineBucket {
  return {
    itemCount: 0,
    subtotal: 0,
    withMarkup: 0,
    provisionalSubtotal: 0,
    provisionalWithMarkup: 0,
  };
}

export function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    DEM: zeroBucket(),
    CIV: zeroBucket(),
    ASB: zeroBucket(),
    SUB: zeroBucket(),
    Other: zeroBucket(),
    cutting: { itemCount: 0, subtotal: 0 },
    tenderPrice: 0,
    provisionalTotal: 0,
    ...overrides,
  };
}
