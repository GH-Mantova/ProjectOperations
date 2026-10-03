import { TooltipSelect, type TooltipSelectOption } from "../../../components";
import type { ScopeItem } from "../ScopeQuantitiesTable";
import {
  EnclosureLinesTable,
  enclosureLineCount
} from "./EnclosureLinesTable";
import type { EnclosureLine } from "../../../lib/enclosure-lines-api";

// ── SCOPE_WBS_ACTIONS_V1 — the ACM expandable (asbestos cards only) ──────
//
// The one block in this slice that is genuinely NEW UI rather than a
// relocation: before it there was nowhere on a WBS item to record what the
// asbestos-containing material actually is, or whether the removal needs an
// enclosure and air monitoring. Estimators were carrying it in the notes.
//
// It is still WEB-ONLY. All four fields already exist end to end and this
// slice adds no API surface whatsoever:
//   * ScopeOfWorksItem.acmType / acmMaterial / enclosureRequired /
//     airMonitoring are columns on the model (schema.prisma, "// Asbestos");
//   * all four are on ScopeItemFieldsBase in scope-of-works.dto.ts and are
//     mapped by numericFieldsFrom() in scope-of-works.service.ts, so the
//     existing PATCH /tenders/:id/scope/items/:itemId persists them;
//   * listItems() spreads the whole row, so they come back on the next read.
// What was missing was a WRITER. This is the writer.
//
// The class badge is DERIVED, never stored and never independently settable —
// see acmClassForType. Class is a legal consequence of friability, not a
// second opinion about it, and an ERP that let the two disagree would be
// stating on a quote that friable ACM is coming out under Class B controls.

/** Stored ACM type values. These are the strings already in the database. */
export const ACM_TYPE_FRIABLE = "friable";
export const ACM_TYPE_BONDED = "bonded";

// ASB_ENCLOSURE_LINES_UI_V1 — note text shown inside the ACM block.
// Exact wording per brief (2026-10-03).
export const ASB_CARD_ENCLOSURE_NOTE =
  "Enclosure materials and hire, air monitoring and clearance are priced from the enclosure rate table. The labour to build and strip the enclosure stays as men × days.";

/**
 * ACM type options.
 *
 * The VALUES are the ones seed.ts already writes to ScopeOfWorksItem.acmType
 * ("friable" / "bonded") so this block reads and writes the same vocabulary as
 * the rows that are already there. The LABELS are the words the estimator
 * uses, and "Non-friable" is the label on the bonded value — the two are the
 * same statement about the material.
 */
export const ACM_TYPE_OPTIONS: TooltipSelectOption<string>[] = [
  { value: ACM_TYPE_FRIABLE, label: "Friable" },
  { value: ACM_TYPE_BONDED, label: "Non-friable (bonded)" }
];

/** Removal class: A for friable, B for non-friable. Null when no type is set. */
export type AcmClass = "A" | "B" | null;

/**
 * SCOPE_WBS_ACTIONS_V1 — the class badge, derived from the ACM type.
 *
 * Friable → Class A. Non-friable → Class B. There is deliberately no setter
 * and no stored column: the badge is a function of acmType and nothing else,
 * so it cannot drift away from it.
 *
 * Matching is case- and spelling-tolerant on purpose. The stored vocabulary is
 * "friable"/"bonded", but "Non-friable" is the phrase on the register and on
 * every survey PDF an estimator types from, and a row that says non-friable
 * must not read as "no class" just because it did not say bonded. Anything
 * genuinely unrecognised returns null rather than guessing a class.
 */
export function acmClassForType(acmType: string | null | undefined): AcmClass {
  if (typeof acmType !== "string") return null;
  const t = acmType.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (t === "friable") return "A";
  if (t === "bonded" || t === "non-friable" || t === "nonfriable") return "B";
  return null;
}

/** Badge text for a derived class. */
export function acmClassLabel(acmClass: AcmClass): string {
  return acmClass === null ? "—" : `Class ${acmClass}`;
}

/**
 * ACM material options, with the stored value appended when it is not one of
 * them. A select whose current value is absent from its options renders as
 * blank, which would silently misreport an item as having no material
 * recorded — and the column is free text, so an unknown value is expected.
 */
export const ACM_MATERIAL_OPTIONS: TooltipSelectOption<string>[] = [
  { value: "pipe_insulation", label: "Pipe insulation / lagging" },
  { value: "sprayed_limpet", label: "Sprayed limpet / thermal coating" },
  { value: "vinyl_tile", label: "Vinyl floor tile" },
  { value: "cement_sheet", label: "Cement sheet / fibro" },
  { value: "roof_sheet", label: "Corrugated roof sheet" },
  { value: "gasket_rope", label: "Gasket / rope seal" },
  { value: "mastic_adhesive", label: "Mastic / adhesive" },
  { value: "other", label: "Other" }
];

export function acmMaterialOptions(current: string | null | undefined): TooltipSelectOption<string>[] {
  if (typeof current !== "string" || current === "") return ACM_MATERIAL_OPTIONS;
  if (ACM_MATERIAL_OPTIONS.some((o) => o.value === current)) return ACM_MATERIAL_OPTIONS;
  return [...ACM_MATERIAL_OPTIONS, { value: current, label: current }];
}

/** Item fields the ACM block reads. */
type AcmSource = Pick<
  ScopeItem,
  "acmType" | "acmMaterial" | "enclosureRequired" | "airMonitoring"
>;

/**
 * How many ACM facts the item carries — the actions-column count on
 * `+ Add enclosure / monitoring`. A false tick is not a fact: an item whose
 * enclosureRequired is explicitly false has been answered, but the button's
 * count is "what has been recorded here", and counting an unticked box would
 * put a tick on every asbestos item on the card.
 *
 * ASB_ENCLOSURE_LINES_UI_V1 — also includes the count of priced enclosure
 * lines if `enclosureLines` is supplied. The lines are fetched by
 * EnclosureLinesTable and reported upward via onLinesChanged; the caller
 * (ScopeQuantitiesTable) caches the count per item and passes it here.
 */
export function acmFactCount(item: AcmSource, pricedLineCount = 0): number {
  let n = 0;
  if (typeof item.acmType === "string" && item.acmType.trim() !== "") n += 1;
  if (typeof item.acmMaterial === "string" && item.acmMaterial.trim() !== "") n += 1;
  if (item.enclosureRequired === true) n += 1;
  if (item.airMonitoring === true) n += 1;
  n += pricedLineCount;
  return n;
}

export type WbsAcmBlockProps = {
  item: ScopeItem;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  // ASB_ENCLOSURE_LINES_UI_V1 — the enclosure lines table is mounted inside
  // this block. tenderId is required for the table's API calls (itemId is
  // taken from item.id). onLinesChanged is called whenever the line list
  // changes so the parent can refresh the item total and the action count.
  tenderId: string;
  onLinesChanged?: (lines: EnclosureLine[]) => void;
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  marginBottom: 2
};

/**
 * SCOPE_WBS_ACTIONS_V1 — ACM type, ACM material, the derived class badge, and
 * the enclosure / air-monitoring ticks.
 *
 * ASB_ENCLOSURE_LINES_UI_V1 — also mounts the EnclosureLinesTable below the
 * ticks. Rendered ONLY on an asbestos card, and only when the estimator has
 * opened it from the actions column; the caller owns both conditions and the
 * block starts closed.
 */
export function WbsAcmBlock({ item, isAi, onPatch, tenderId, onLinesChanged }: WbsAcmBlockProps) {
  const acmClass = acmClassForType(item.acmType);

  return (
    <div
      data-testid="wbs-acm-block"
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: 6,
        padding: 8,
        background: "var(--surface-muted)",
        maxWidth: 860
      }}
    >
      {/* ASB_ENCLOSURE_LINES_UI_V1 — note explaining the pricing model */}
      <p
        data-testid="wbs-acm-note"
        style={{
          fontSize: 12.5,
          color: "var(--text-secondary)",
          margin: "0 0 8px 0",
          padding: "6px 10px",
          background: "var(--surface-warning-subtle)",
          border: "1px solid var(--border-warning)",
          borderRadius: 6
        }}
      >
        {ASB_CARD_ENCLOSURE_NOTE}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end"
        }}
      >
      <div style={{ display: "flex", flexDirection: "column", width: 180 }}>
        <span className="s7-type-label" style={labelStyle}>
          ACM type
        </span>
        <TooltipSelect
          value={item.acmType ?? null}
          options={ACM_TYPE_OPTIONS}
          onChange={(v) => onPatch({ acmType: v })}
          disabled={isAi}
          ariaLabel={`ACM type for ${item.wbsCode}`}
          style={{ height: 32 }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", width: 220 }}>
        <span className="s7-type-label" style={labelStyle}>
          ACM material
        </span>
        <TooltipSelect
          value={item.acmMaterial ?? null}
          options={acmMaterialOptions(item.acmMaterial)}
          onChange={(v) => onPatch({ acmMaterial: v })}
          disabled={isAi}
          ariaLabel={`ACM material for ${item.wbsCode}`}
          style={{ height: 32 }}
        />
      </div>

      {/* Derived from the type above — no control, because there is nothing to
          decide. Friable is Class A; non-friable is Class B. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span className="s7-type-label" style={labelStyle}>
          Class
        </span>
        <span
          data-testid="wbs-acm-class-badge"
          aria-label={`Removal class for ${item.wbsCode}`}
          title="Derived from the ACM type: friable is Class A, non-friable is Class B."
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 32,
            padding: "0 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
            background:
              acmClass === "A"
                ? "var(--status-danger)"
                : acmClass === "B"
                  ? "var(--status-warning)"
                  : "var(--surface-muted)",
            color: acmClass === null ? "var(--text-muted)" : "var(--color-white)"
          }}
        >
          {acmClassLabel(acmClass)}
        </span>
      </div>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32 }}>
        <input
          type="checkbox"
          checked={item.enclosureRequired === true}
          disabled={isAi}
          onChange={(e) => onPatch({ enclosureRequired: e.target.checked })}
          aria-label={`Enclosure required for ${item.wbsCode}`}
          style={{ width: 18, height: 18 }}
        />
        <span style={{ fontSize: 12 }}>Enclosure required</span>
      </label>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32 }}>
        <input
          type="checkbox"
          checked={item.airMonitoring === true}
          disabled={isAi}
          onChange={(e) => onPatch({ airMonitoring: e.target.checked })}
          aria-label={`Air monitoring for ${item.wbsCode}`}
          style={{ width: 18, height: 18 }}
        />
        <span style={{ fontSize: 12 }}>Air monitoring</span>
      </label>
      </div>{/* end controls flex row */}

      {/* ASB_ENCLOSURE_LINES_UI_V1 — the priced enclosure / monitoring /
          clearance table, rendered below the tick fields. */}
      <EnclosureLinesTable
        tenderId={tenderId}
        itemId={item.id}
        isReadOnly={isAi}
        onLinesChanged={onLinesChanged}
      />
    </div>
  );
}

// Re-export so callers that import from this module can get the count helper.
export { enclosureLineCount };
// Re-export the EnclosureLine type so callers can wire the callback.
export type { EnclosureLine };
