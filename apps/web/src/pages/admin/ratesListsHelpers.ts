/**
 * Pure helpers for the Rates & Lists admin page (R0b slice 1).
 *
 * Keeping the shaping / client-side validation out of the component so it
 * can be exercised by vitest — the component itself is smoke-tested from
 * the PR checklist.
 */

import type { RateLineField } from "@project-ops/config/charge-step-semantics";
import type { ChargeStep } from "../../lib/chargeStepTypes";

export type RateColumnDataType = "TEXT" | "NUMBER" | "CURRENCY" | "DATE" | "BOOL" | "LIST_REF";
export type RateColumnRole = "KEY" | "VALUE" | "INFO";

export type RateColumn = {
  id: string;
  name: string;
  dataType: RateColumnDataType;
  role: RateColumnRole;
  unit: string | null;
  listSlug: string | null;
  required: boolean;
  min: number | null;
  max: number | null;
  sortOrder: number;
};

export type RateRow = {
  id: string;
  cells: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
};

export type ListBindingConsumerType = "RATE_COLUMN" | "FORM_FIELD" | "MODULE_DROPDOWN";

export type ListBinding = {
  id: string;
  listId: string;
  consumerType: ListBindingConsumerType;
  consumerRef: string;
  label: string | null;
};

/** Human-readable label for the where-used tab. */
export function consumerTypeLabel(type: ListBindingConsumerType): string {
  switch (type) {
    case "RATE_COLUMN":
      return "Rate column";
    case "FORM_FIELD":
      return "Form field";
    case "MODULE_DROPDOWN":
      return "Module dropdown";
  }
}

/**
 * Group bindings by consumer type for the "Linked to" tab. Deterministic
 * order — the consumer-type order defined below drives the section list so
 * the UI never renders empty sections in an unpredictable order.
 */
export function groupBindings(
  bindings: ListBinding[]
): Array<{ type: ListBindingConsumerType; label: string; items: ListBinding[] }> {
  const order: ListBindingConsumerType[] = ["RATE_COLUMN", "FORM_FIELD", "MODULE_DROPDOWN"];
  return order
    .map((type) => ({
      type,
      label: consumerTypeLabel(type),
      items: bindings
        .filter((b) => b.consumerType === type)
        .slice()
        .sort((a, b) => a.consumerRef.localeCompare(b.consumerRef))
    }))
    .filter((group) => group.items.length > 0);
}

/** Delete-safety copy for a list. */
export function whereUsedBlockerMessage(count: number): string {
  if (count === 0) return "Not linked to anything — safe to archive.";
  if (count === 1) return "1 binding still uses this list. Remove it before delete.";
  return `${count} bindings still use this list. Remove them before delete.`;
}

/** Default empty cell value for a new row keyed by column dataType. */
export function defaultCellFor(dataType: RateColumnDataType): unknown {
  switch (dataType) {
    case "BOOL":
      return false;
    case "NUMBER":
    case "CURRENCY":
      return "";
    case "DATE":
    case "TEXT":
    case "LIST_REF":
      return "";
  }
}

/** Build a blank cells map for a new row given the current column set. */
export function blankRowCells(columns: RateColumn[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) out[c.id] = defaultCellFor(c.dataType);
  return out;
}

/**
 * Client-side row validation. Cheap, cheerful, and independent of the
 * server (which does the authoritative pass on commit). Returns an array
 * of `{ columnId, message }` — empty means the row is submittable.
 * We keep this deliberately narrower than the server: it flags obvious
 * mistakes (required-blank, non-numeric CURRENCY/NUMBER, VALUE < 0) so the
 * user gets feedback before Save, then relies on the server for the
 * data-layer invariants (dup-key, LIST_REF freshness, min/max bounds).
 */
export type CellError = { columnId: string; message: string };

export function validateRowCells(columns: RateColumn[], cells: Record<string, unknown>): CellError[] {
  const errors: CellError[] = [];
  for (const c of columns) {
    const raw = cells[c.id];
    const isEmpty = raw === undefined || raw === null || raw === "";
    if (c.required && isEmpty) {
      errors.push({ columnId: c.id, message: `${c.name} is required.` });
      continue;
    }
    if (isEmpty) continue;
    if (c.dataType === "NUMBER" || c.dataType === "CURRENCY") {
      const asString = typeof raw === "number" ? String(raw) : String(raw).trim();
      const parsed = Number(asString);
      if (!Number.isFinite(parsed)) {
        errors.push({ columnId: c.id, message: `${c.name} must be a number.` });
        continue;
      }
      if (c.role === "VALUE" && parsed < 0) {
        errors.push({ columnId: c.id, message: `${c.name} must be ≥ 0.` });
      }
    }
  }
  return errors;
}

/**
 * UNIT_PER_ROW_V1 — column names (trimmed, lower-cased, matched whole) that
 * mark an INFO column as the table's per-row unit carrier. Whole-name match,
 * never a substring: "Unit rate" and "Unit cost" are money columns and say
 * nothing about the basis a row bills on.
 *
 * Mirrors PER_ROW_UNIT_COLUMN_NAMES in the API's rate-validation.service.ts.
 */
const PER_ROW_UNIT_COLUMN_NAMES = new Set(["unit", "units"]);

/**
 * UNIT_PER_ROW_V1 — does this column set carry its units per row?
 *
 * True when some INFO column is named "Unit"/"Units" and holds free text (a
 * TEXT column, or a LIST_REF one drawing units from a GlobalList). Mirrors
 * `hasPerRowUnitColumn` in the API's rate-validation.service.ts; the two must
 * agree, or the admin screen shows a "Structure issues" banner for a shape
 * the server will happily save (or, worse, hides one it will reject).
 */
export function hasPerRowUnitColumn(
  columns: Pick<RateColumn, "name" | "dataType" | "role">[]
): boolean {
  return columns.some(
    (c) =>
      c.role === "INFO" &&
      (c.dataType === "TEXT" || c.dataType === "LIST_REF") &&
      PER_ROW_UNIT_COLUMN_NAMES.has((c.name ?? "").trim().toLowerCase())
  );
}

/**
 * Structure check for a proposed column set. Mirrors the server's
 * `assertStructure` (spec §4) so the New Table wizard can warn early
 * without a round-trip. Server remains the source of truth.
 *
 * UNIT_PER_ROW_V1: a VALUE column may omit its unit when the table has a
 * per-row unit column — `other-rates` bills every row on a different basis
 * ("per visit", "p/hr", "p/hr/man"), so its unit lives per row in an INFO
 * column and no per-column value is correct. Permissive only: a VALUE column
 * that names a unit is still fine either way (`plant` has both, deliberately).
 */
export function validateColumnStructure(
  columns: Pick<RateColumn, "name" | "dataType" | "role" | "unit" | "listSlug">[]
): string[] {
  const errors: string[] = [];
  if (columns.length === 0) {
    errors.push("Add at least one column.");
    return errors;
  }
  if (!columns.some((c) => c.role === "KEY")) {
    errors.push("Need at least one KEY column (rows are matched by their KEY tuple).");
  }
  const values = columns.filter((c) => c.role === "VALUE");
  if (values.length === 0) {
    errors.push("Need at least one VALUE column — a table with no $ column is a List, not a Rate.");
  }
  const unitPerRow = hasPerRowUnitColumn(columns);
  for (const v of values) {
    if (!v.unit || !v.unit.trim()) {
      // UNIT_PER_ROW_V1 — the rows carry their own unit, so this column needs none.
      if (unitPerRow) continue;
      errors.push(`VALUE column "${v.name}" needs a unit (e.g. hr, m, tonne).`);
    }
  }
  for (const c of columns) {
    if (c.dataType === "LIST_REF" && (!c.listSlug || !c.listSlug.trim())) {
      errors.push(`LIST_REF column "${c.name}" needs a list slug.`);
    }
  }
  return errors;
}

// ── RATE_FIELDS_TABLE_V2 ──────────────────────────────────────────────────
//
// What the Fields card prints about a field, as pure functions.
//
// The card used to answer none of the three questions a person editing a
// charge rule actually has: where does this value come from, what kind of
// thing is it, and what breaks if I delete it. Everything below exists to
// answer one of those three, and NONE of it changes how a field is stored —
// `role`, `required`, `dataType` and `listSlug` are untouched in the data and
// still drive the add-column form, `validateRowCells` and the server.
//
// This file is the ONE place the kind rule lives. `numericFieldOptions` and
// the charge-step operand picker in ChargeStepsEditor.tsx read
// `isNumberKindColumn` from here, so the label the card prints and the menu
// the picker offers cannot disagree about what counts as a number.

/**
 * What a field IS, in the reader's words rather than the storage enum.
 *
 * Storage says TEXT / NUMBER / CURRENCY / DATE / BOOL / LIST_REF. A person
 * setting up a charge rule is deciding whether a value can go in the sum, and
 * "CURRENCY" and "LIST_REF" tell them nothing about that. These four words do.
 */
export type FieldKind = "number" | "text" | "date" | "yes / no";

/**
 * Every member of `RateColumnDataType`, mapped to the word the card prints.
 *
 * Deliberately a `Record` over the whole union and not a `switch` with a
 * default: adding a seventh member to `RateColumnDataType` is then a COMPILE
 * ERROR here rather than a column that silently prints the wrong word and
 * silently vanishes from the operand picker.
 *
 * NUMBER and CURRENCY are both `number` — money is a number you can multiply
 * by. DATE and BOOL get their own words rather than being forced into `text`:
 * they are not text, and saying they are would be a lie the operand picker
 * then acts on.
 */
export const RATE_COLUMN_KIND: Record<RateColumnDataType, FieldKind> = {
  NUMBER: "number",
  CURRENCY: "number",
  TEXT: "text",
  LIST_REF: "text",
  DATE: "date",
  BOOL: "yes / no"
};

/**
 * The kind a rate-table column prints.
 *
 * Takes a `string` rather than `RateColumnDataType` because `RateColumnMeta`
 * in ChargeStepsEditor.tsx carries `dataType: string` — the value is always
 * one of the six in practice, and anything else falls back to `text`, which is
 * the conservative answer: a name whose kind is unknown is offered to the
 * condition picker and kept out of the sum, rather than fed to arithmetic.
 */
export function columnFieldKind(dataType: string): FieldKind {
  return RATE_COLUMN_KIND[dataType as RateColumnDataType] ?? "text";
}

/**
 * THE rule for what may be an arithmetic operand: number-kind only.
 *
 * One function, two callers — this card's `Kind` column and the charge-step
 * operand picker — so the two cannot end up disagreeing about, say, whether a
 * DATE column belongs in a multiply.
 */
export function isNumberKindColumn(dataType: string): boolean {
  return columnFieldKind(dataType) === "number";
}

/**
 * The two places a value comes from. Named `table` / `line` here and rendered
 * through `FIELD_SOURCE_LABELS` in ChargeStepsEditor.tsx, which owns the words
 * ("the rate table" / "the estimate line") so the operand picker's `<optgroup>`
 * labels and this card's `From` column are literally the same two strings.
 */
export type RateFieldSource = "table" | "line";

/** One row of the Fields table. */
export type RateFieldRow = {
  /**
   * The column id, for a rate-table column. Null for a line field: a line
   * field has no id and no delete route, so its row carries no delete control.
   */
  id: string | null;
  name: string;
  source: RateFieldSource;
  kind: FieldKind;
  /** The `Unit` cell. Null prints as an em dash. */
  unit: string | null;
  /**
   * The GlobalList a LIST_REF column draws its values from, when it has one.
   * Printed under the field name — the mock-up drops it, but it is the only
   * on-screen statement of which list feeds a column.
   */
  listSlug: string | null;
  /** One-based step numbers naming this field, ascending, each at most once. */
  usedIn: number[];
};

/**
 * The one-based step numbers that name a field — the `Used in` column.
 *
 * BOTH places a name can appear count: the arithmetic operand (`field`) and
 * the condition field (`when.field`). The server rejects a step list that
 * names a field that is not there in either position, so a `Used in` that
 * counted only operands would under-report exactly the deletion that breaks a
 * save.
 *
 * A step that names the field TWICE — `multiply by Rate only when Rate > 5` —
 * is listed once. It is one step; printing "step 3, 3" would read as two.
 */
export function stepsUsingField(
  steps: readonly ChargeStep[] | null | undefined,
  name: string
): number[] {
  const out: number[] = [];
  (steps ?? []).forEach((step, i) => {
    const operand = "field" in step && typeof step.field === "string" && step.field === name;
    const condition = "when" in step && step.when != null && step.when.field === name;
    if (operand || condition) out.push(i + 1);
  });
  return out;
}

/** How the `Used in` cell reads: `step 1, 5`, or an em dash for nothing. */
export function usedInLabel(usedIn: readonly number[]): string {
  return usedIn.length === 0 ? "—" : `step ${usedIn.join(", ")}`;
}

/**
 * Every field the steps can use, in the order the card lists them: the rate
 * table's columns as the table orders them, then the line fields as they are
 * declared.
 *
 * The order groups by `From`, which is the distinction this card exists to
 * draw, and keeps the columns in the same order as the Rows card directly
 * below — two adjacent tables listing the same columns in two different orders
 * is the confusion this slice is meant to remove, not add.
 */
export function rateFieldRows(
  columns: readonly Pick<
    RateColumn,
    "id" | "name" | "dataType" | "unit" | "listSlug"
  >[],
  lineFields: readonly RateLineField[] | null | undefined,
  steps: readonly ChargeStep[] | null | undefined
): RateFieldRow[] {
  const rows: RateFieldRow[] = columns.map((c) => ({
    id: c.id,
    name: c.name,
    source: "table" as const,
    kind: columnFieldKind(c.dataType),
    unit: c.unit ?? null,
    listSlug: c.listSlug ?? null,
    usedIn: stepsUsingField(steps, c.name)
  }));
  for (const f of lineFields ?? []) {
    rows.push({
      id: null,
      name: f.name,
      source: "line",
      // A line field already declares its kind in the reader's words.
      kind: f.kind === "text" ? "text" : "number",
      unit: f.unit ?? null,
      listSlug: null,
      usedIn: stepsUsingField(steps, f.name)
    });
  }
  return rows;
}

/**
 * The warning a delete has to carry when steps name the field, or null when
 * none do.
 *
 * It names the steps because "this will break something" is not actionable and
 * "step 5 stops working" is. Today the delete asks a generic question, the
 * server allows it (`deleteColumn` refuses only while the table still has
 * rows), and the first anyone hears of the damage is a 400 the next time the
 * charge steps are saved:
 *
 *   Step 4 (op: multiply): field "Rate" is not a column or line field on this table.
 *
 * This does NOT invent a new refusal. The delete still goes through if the
 * person says yes — changing what is permitted is a server rule, not a card's.
 */
export function deleteFieldWarning(name: string, usedIn: readonly number[]): string | null {
  if (usedIn.length === 0) return null;
  const many = usedIn.length > 1;
  return (
    `"${name}" is used in ${usedInLabel(usedIn)}. ` +
    `Delete it and ${many ? "those steps name" : "that step names"} a field that is not ` +
    `there — the charge steps will not save until ${many ? "they are" : "it is"} changed.`
  );
}

/** The whole confirm-dialog message for a field delete, warning included. */
export function deleteFieldConfirmMessage(name: string, usedIn: readonly number[]): string {
  const base = `Delete "${name}"? Any values stored for it will be dropped.`;
  const warning = deleteFieldWarning(name, usedIn);
  return warning ? `${base} ${warning}` : base;
}
