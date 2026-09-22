// CHARGE_STEPS_PRICE_CUTTING_V1
//
// ChargeStepPricingService - prices a rate-table row through its charge steps.
//
// Responsibilities:
//   1. Load the RateTable for a given slug (shared loader, cached per slug).
//   2. For a locked tender, check for a chargeStepsSnapshot entry and use the
//      frozen copy instead of the live table.
//   3. Build the step-values map from row cells + line field inputs.
//   4. Run evaluateSteps and return the computed total with its trail.
//   5. Return null when the table has no steps; return null + issues list
//      when a step cannot be worked out.
//
// Call pattern: priceRow() is awaited by callers who USE the result. This is
// the key difference from the parity harness (ChargeStepParityService) which
// is fire-and-forget and returns void.
//
// The shared loadTable / findMatchedCells logic is exposed as non-private
// methods so ChargeStepParityService can call them rather than owning a
// duplicate DB path.

export const CHARGE_STEPS_PRICE_CUTTING_V1 = "scopecards-s5";

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { evaluateSteps } from "./rate-step-evaluator";
import type { ChargeStep, ChargeStepIssue, ChargeStepTrailEntry } from "./rate-step-evaluator";
import { readStoredLineFields } from "./rate-tables.service";
import { buildStepValues } from "@project-ops/config/charge-step-semantics";
import type { RateLineField, StepValueColumn } from "@project-ops/config/charge-step-semantics";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Per-slug cache entry. Loaded once per service instance (singleton) because
 * charge steps and column definitions change only via admin actions.
 * `steps: null` means the table has no chargeSteps.
 */
interface CachedTable {
  id: string;
  slug: string;
  steps: ChargeStep[] | null;
  /** All columns in sortOrder — used for buildStepValues. */
  columns: StepValueColumn[];
  /** Column role by column ID — used for filtering KEY columns in row match. */
  columnRoles: Map<string, string>;
  lineFields: RateLineField[];
}

/**
 * Shape stored in TenderRateSet.chargeStepsSnapshot for a single slug.
 * { [slug]: ChargeStepsSnapshotEntry }
 */
interface ChargeStepsSnapshotEntry {
  chargeSteps: ChargeStep[];
  lineFields: RateLineField[];
  columns: Array<{ name: string; role: string }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ChargeStepPricingService {
  /** Per-slug cache. Safe as a class-level map (singleton service). */
  private readonly tableCache = new Map<string, CachedTable>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * CHARGE_STEPS_PRICE_CUTTING_V1 — public entry point.
   *
   * Prices a single rate-table row through its configured charge steps.
   *
   * @param input.tableSlug   Rate-table slug to load steps from.
   * @param input.row         The already-resolved rate row (value = base rate).
   * @param input.lineFields  Per-line inputs (e.g. { method, depthMm, metres }).
   * @param input.tenderId    Optional: when set, the locked chargeStepsSnapshot
   *                          for this tender is used instead of the live table.
   *
   * @returns null when the table has no steps (caller takes the raw row value).
   *          null when any step fails (issues list is non-empty).
   *          { value, trail, issues } on success.
   */
  async priceRow(input: {
    tableSlug: string;
    row: { value: number; rowId?: string; keys?: Record<string, unknown> };
    lineFields: Record<string, string | number>;
    tenderId?: string | null;
  }): Promise<{ value: number; trail: ChargeStepTrailEntry[]; issues: ChargeStepIssue[] } | null> {
    // 1. Resolve which step list + schema to use.
    let steps: ChargeStep[];
    let columns: StepValueColumn[];
    let columnRoles: Map<string, string>;
    let lineFieldDefs: RateLineField[];

    if (input.tenderId) {
      // Check the locked snapshot first.
      const snapshotEntry = await this.getSnapshotEntry(input.tenderId, input.tableSlug);
      if (snapshotEntry) {
        steps = snapshotEntry.chargeSteps;
        // Snapshot columns carry name + role but no real DB ID.
        // We use the array index as a synthetic ID so buildStepValues
        // can map cells[syntheticId] -> col.name -> value.
        columns = snapshotEntry.columns.map((c, i) => ({ id: String(i), name: c.name }));
        columnRoles = new Map<string, string>(
          snapshotEntry.columns.map((c, i) => [String(i), c.role])
        );
        lineFieldDefs = snapshotEntry.lineFields;
      } else {
        // No snapshot for this slug — fall through to live table.
        const cached = await this.loadTable(input.tableSlug);
        if (!cached.steps) return null;
        steps = cached.steps;
        columns = cached.columns;
        columnRoles = cached.columnRoles;
        lineFieldDefs = cached.lineFields;
      }
    } else {
      const cached = await this.loadTable(input.tableSlug);
      if (!cached.steps) return null;
      steps = cached.steps;
      columns = cached.columns;
      columnRoles = cached.columnRoles;
      lineFieldDefs = cached.lineFields;
    }

    if (!steps || steps.length === 0) return null;

    // 2. Build the values map.
    // Cells map is keyed by column ID. Only VALUE columns get the row value;
    // KEY column values are not included (they are not used by step arithmetic;
    // conditions use lineFields which arrive via lineValues).
    const cells = this.buildCellsFromRow(input.row.value, columns, columnRoles);

    const values = buildStepValues(
      columns,
      cells,
      lineFieldDefs,
      input.lineFields as Record<string, string | number>
    );

    // 3. Evaluate.
    let result: ReturnType<typeof evaluateSteps>;
    try {
      result = evaluateSteps(steps, values);
    } catch (err) {
      // Steps empty or first step is not "start" — treat as no-steps.
      return null;
    }

    if (result.total === null) {
      // At least one step could not be worked out — return null with issues.
      return null;
    }

    return {
      value: result.total,
      trail: result.trail ?? [],
      issues: result.issues ?? []
    };
  }

  // ---------------------------------------------------------------------------
  // Shared loader — used by ChargeStepParityService to avoid a duplicate DB path
  // ---------------------------------------------------------------------------

  /**
   * Load (and cache) the table data for a given slug.
   * Returns a CachedTable where `steps` is null when the table has no steps.
   * @throws When the DB query itself fails.
   */
  async loadTable(tableSlug: string): Promise<CachedTable> {
    const hit = this.tableCache.get(tableSlug);
    if (hit) return hit;

    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      select: {
        id: true,
        chargeSteps: true,
        lineFields: true,
        columns: {
          select: { id: true, name: true, role: true },
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!table) {
      const empty: CachedTable = {
        id: "",
        slug: tableSlug,
        steps: null,
        columns: [],
        columnRoles: new Map(),
        lineFields: []
      };
      this.tableCache.set(tableSlug, empty);
      return empty;
    }

    const rawSteps = table.chargeSteps;
    const steps: ChargeStep[] | null =
      Array.isArray(rawSteps) && rawSteps.length > 0
        ? (rawSteps as unknown as ChargeStep[])
        : null;

    const lineFields: RateLineField[] = readStoredLineFields(table.lineFields);

    type RawCol = { id: string; name: string; role: string };
    const rawCols = table.columns as RawCol[];

    const columns: StepValueColumn[] = rawCols.map((c) => ({
      id: c.id,
      name: c.name
    }));

    const columnRoles = new Map<string, string>(
      rawCols.map((c) => [c.id, c.role])
    );

    const cached: CachedTable = {
      id: table.id,
      slug: tableSlug,
      steps,
      columns,
      columnRoles,
      lineFields
    };
    this.tableCache.set(tableSlug, cached);
    return cached;
  }

  /**
   * Find the matched RateRow for the given keys and return its cells.
   * Mirrors key-matching logic in RateResolverService.tryRateTable.
   * Returns null when no row matches.
   */
  async findMatchedCells(
    cached: CachedTable,
    keys: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    if (!cached.id) return null;

    const rawRows = await this.prisma.rateRow.findMany({
      where: { rateTableId: cached.id, isActive: true },
      select: { cells: true }
    });
    const rows = rawRows as Array<{ cells: unknown }>;
    if (rows.length === 0) return null;

    const keysLower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(keys)) {
      keysLower[k.trim().toLowerCase()] = v;
    }

    const norm = (v: unknown): string =>
      v === undefined || v === null ? "" : String(v).trim().toLowerCase();

    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return cached.columns.every((c) => {
        if (cached.columnRoles.get(c.id) !== "KEY") return true;
        const colNameLower = c.name.trim().toLowerCase();
        const callerVal = keys[c.name] ?? keysLower[colNameLower] ?? keys[c.id];
        if (callerVal === undefined) return true;
        return norm(cells[c.id]) === norm(callerVal);
      });
    });

    return match ? ((match.cells as Record<string, unknown> | null) ?? {}) : null;
  }

  // ---------------------------------------------------------------------------
  // Snapshot helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch the chargeStepsSnapshot entry for a given tender + slug.
   * Returns null if no set, no snapshot, or the slug is absent from it.
   */
  private async getSnapshotEntry(
    tenderId: string,
    tableSlug: string
  ): Promise<ChargeStepsSnapshotEntry | null> {
    const set = await this.prisma.tenderRateSet.findUnique({
      where: { tenderId },
      select: { chargeStepsSnapshot: true }
    });
    if (!set?.chargeStepsSnapshot) return null;
    const snapshot = set.chargeStepsSnapshot as Record<string, unknown>;
    const entry = snapshot[tableSlug];
    if (!entry || typeof entry !== "object") return null;
    return entry as ChargeStepsSnapshotEntry;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Build a cells map that places the row's base value under the VALUE
   * column ID(s) so buildStepValues can map column ID -> column name -> value.
   *
   * The start step references the VALUE column by name (e.g. "Rate per m").
   * buildStepValues does: for each col in columns, out[col.name] = cells[col.id].
   * So we store the row value under each VALUE-role column ID.
   *
   * KEY columns are intentionally omitted: the step conditions for method
   * ("when method is High-Freq") use lineFields, not KEY column values.
   *
   * @param rowValue    The pre-resolved rate (e.g. 71.30 for Ringsaw 175mm).
   * @param columns     StepValueColumn list (id + name, sortOrder).
   * @param columnRoles Map<columnId, role> from the cached table.
   */
  private buildCellsFromRow(
    rowValue: number,
    columns: StepValueColumn[],
    columnRoles: Map<string, string>
  ): Record<string, unknown> {
    const cells: Record<string, unknown> = {};
    for (const col of columns) {
      const role = columnRoles.get(col.id);
      if (role === "VALUE") {
        cells[col.id] = rowValue;
      }
    }
    return cells;
  }
}
