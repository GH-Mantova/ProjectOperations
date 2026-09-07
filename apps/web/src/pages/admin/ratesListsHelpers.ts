/**
 * Pure helpers for the Rates & Lists admin page (R0b slice 1).
 *
 * Keeping the shaping / client-side validation out of the component so it
 * can be exercised by vitest — the component itself is smoke-tested from
 * the PR checklist.
 */

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
