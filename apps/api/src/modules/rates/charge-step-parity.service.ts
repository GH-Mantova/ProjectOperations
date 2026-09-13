// RATE_PARITY_HARNESS_V1
//
// Charge-step parity harness — first slice of the rates-parity-gate cluster.
//
// For every priced line it is handed, the harness:
//   1. Loads the RateTable matching the slug (cached per slug within the
//      service instance — one DB round-trip per table, not one per line).
//   2. Evaluates the stored chargeSteps with evaluateSteps against the matched
//      row's cells and any declared lineFields.
//   3. Compares the step total to the value the current pricing path resolved.
//   4. Logs every disagreement (and every agreement, for the denominator).
//   5. Returns nothing. The step total is a local and a log field only.
//
// WHY THE HARNESS CANNOT CHANGE A PRICE:
//   - The public method returns Promise<void>. A method that returns a number
//     can be wired into a price by a one-line edit; one that returns nothing
//     cannot.
//   - The call site in RateResolverService is a fire-and-forget statement,
//     never assigned and never part of a return expression.
//   - The entire charge-step evaluation is wrapped in try/catch. Any throw
//     from evaluateSteps (empty steps, non-start first step, divide-by-zero,
//     StepArithmeticTypeError) is caught, logged as a disagreement of its own
//     kind, and the method returns normally — the caller's resolved price is
//     unaffected.
//   - chargeSteps for each table are cached per slug so a request that prices
//     many lines for the same table pays one DB round-trip, not one per line.
//
// OBSERVATION WINDOW: not yet started. This file ships the harness; the soak
// begins once the PR is merged and deployed. No production figures are
// available from the code-writer worktree.

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { evaluateSteps } from "./rate-step-evaluator";
import type { ChargeStep } from "./rate-step-evaluator";
import { readStoredLineFields } from "./rate-tables.service";
import { buildStepValues } from "@project-ops/config/charge-step-semantics";
import type { RateLineField, StepValueColumn } from "@project-ops/config/charge-step-semantics";

// ---------------------------------------------------------------------------
// Internal cache structure
// ---------------------------------------------------------------------------

/**
 * What the harness caches per table slug.
 * `steps: null` means the table has no chargeSteps — checkParity returns
 * immediately without logging (there is nothing to compare).
 */
interface CachedTable {
  id: string;
  steps: ChargeStep[] | null;
  /** KEY + VALUE + INFO columns — used to build the values map. */
  columns: StepValueColumn[];
  /** KEY columns only — used for row matching. */
  keyColumnIds: Set<string>;
  lineFields: RateLineField[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ChargeStepParityService {
  private readonly logger = new Logger(ChargeStepParityService.name);

  /**
   * Per-slug cache for the table's steps, columns, and lineFields.
   * Safe as a class-level map (singleton service): step lists and column
   * definitions change only via admin actions, not during a pricing run.
   */
  private readonly tableCache = new Map<string, CachedTable>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * RATE_PARITY_HARNESS_V1 — public entry point.
   *
   * Return type: Promise<void>.
   * The charge-step total is computed, compared against resolvedValue, logged,
   * and then discarded. It never reaches the caller. This method never throws.
   *
   * @param tableSlug     The slug passed into resolveRate.
   * @param keys          The resolution keys passed into resolveRate.
   * @param resolvedValue The value the current pricing path produced — the
   *                      number that WILL be used to price the line.
   * @param tenderId      The tender being priced — carried into log records.
   */
  async checkParity(
    tableSlug: string,
    keys: Record<string, unknown>,
    resolvedValue: number,
    tenderId: string | undefined
  ): Promise<void> {
    try {
      await this._check(tableSlug, keys, resolvedValue, tenderId);
    } catch (err) {
      // Belt-and-suspenders outer catch — _check itself catches all
      // evaluation errors, but if the catch branch itself fails we must
      // not surface it to the pricing path.
      this.logger.warn({
        event: "charge-step-parity-outer-catch",
        tableSlug,
        tenderId,
        keys,
        err: err instanceof Error ? err.message : String(err)
      });
    }
  }

  private async _check(
    tableSlug: string,
    keys: Record<string, unknown>,
    resolvedValue: number,
    tenderId: string | undefined
  ): Promise<void> {
    // 1. Load (and cache) the table.
    let cached: CachedTable;
    try {
      cached = await this.loadTable(tableSlug);
    } catch (err) {
      this.logger.warn({
        event: "charge-step-parity-load-error",
        tableSlug,
        tenderId,
        keys,
        err: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    if (!cached.steps) {
      // No charge steps configured on this table — nothing to compare.
      return;
    }

    // 2. Find the matched row's cells. Legacy slugs have no RateTable rows;
    //    the cells map will be null and numeric-literal-only steps still work.
    let cells: Record<string, unknown> | null;
    try {
      cells = await this.findMatchedCells(cached, keys);
    } catch (err) {
      this.logger.warn({
        event: "charge-step-parity-row-lookup-error",
        tableSlug,
        tenderId,
        keys,
        err: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    // 3. Build the values map using the shared buildStepValues function —
    //    exactly the same function the editor preview calls, so the values
    //    map is identical to what the editor used when the rule was authored.
    const values = buildStepValues(
      cached.columns,
      cells,
      cached.lineFields
      // lineValues omitted — the harness has no per-line estimator input.
      // A line field with no sample is absent from the map; evaluateSteps
      // handles it as a missing-operand issue, not a throw.
    );

    // 4. Evaluate the steps. Any throw is caught and logged.
    let stepTotal: number | null;
    let divergeAtStepIndex: number | null = null;

    try {
      const evaluation = evaluateSteps(cached.steps, values);
      stepTotal = evaluation.total;

      if (stepTotal === null) {
        // evaluateSteps completed but a step could not be computed —
        // total is null. Log as a disagreement so the soak counts it.
        const firstIssue = evaluation.issues?.[0];
        this.logger.warn({
          event: "charge-step-parity-step-null-total",
          tableSlug,
          tableId: cached.id,
          tenderId,
          keys,
          resolvedValue,
          stepTotal: null,
          firstIssueCode: firstIssue?.code ?? null,
          firstIssueStep: firstIssue?.stepIndex ?? null
        });
        return;
      }

      // 5. Identify the step index at which the two answers first part
      //    company. The trail carries { index, op, runningTotal, skipped };
      //    we walk it to find the first non-skipped step whose runningTotal
      //    differs from the resolved value. This is the earliest step ops
      //    need to inspect.
      if (evaluation.trail && stepTotal !== resolvedValue) {
        for (const entry of evaluation.trail) {
          if (entry.skipped) continue;
          if (entry.runningTotal !== null && entry.runningTotal !== resolvedValue) {
            divergeAtStepIndex = entry.index;
            break;
          }
        }
      }
    } catch (err) {
      // evaluateSteps threw — log as a disagreement of its own kind.
      this.logger.warn({
        event: "charge-step-parity-eval-threw",
        tableSlug,
        tableId: cached.id,
        tenderId,
        keys,
        resolvedValue,
        stepTotal: null,
        err: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    // 6. Emit the verdict.
    if (stepTotal === resolvedValue) {
      // Agreement — logged at log level so the denominator is countable.
      this.logger.log({
        event: "charge-step-parity-agree",
        tableSlug,
        tableId: cached.id,
        tenderId
      });
    } else {
      // Disagreement — both numbers named in the same record so the soak
      // log can be read, not just counted.
      this.logger.warn({
        event: "charge-step-parity-disagree",
        tableSlug,
        tableId: cached.id,
        tenderId,
        keys,
        resolvedValue,
        stepTotal,
        divergeAtStepIndex
      });
    }
  }

  /**
   * Load (and cache) the table data for a given slug.
   * Returns a CachedTable where `steps` is null when the table has no steps.
   * @throws When the DB query itself fails — the caller catches this.
   */
  private async loadTable(tableSlug: string): Promise<CachedTable> {
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

    // If the slug is not found in RateTable (e.g. a legacy-only slug),
    // store a sentinel with no steps so we do not query again.
    if (!table) {
      const empty: CachedTable = {
        id: "",
        steps: null,
        columns: [],
        keyColumnIds: new Set(),
        lineFields: []
      };
      this.tableCache.set(tableSlug, empty);
      return empty;
    }

    const rawSteps = table.chargeSteps;
    // Stored steps were validated by validateChargeSteps on write (rate-tables.service.ts);
    // the harness is read-only and every evaluation runs under try/catch, so a malformed
    // row is logged as a disagreement, never thrown into a price.
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

    const keyColumnIds = new Set<string>(
      rawCols.filter((c) => c.role === "KEY").map((c) => c.id)
    );

    const cached: CachedTable = {
      id: table.id,
      steps,
      columns,
      keyColumnIds,
      lineFields
    };
    this.tableCache.set(tableSlug, cached);
    return cached;
  }

  /**
   * Find the matched RateRow for the given keys and return its full cells
   * object. Mirrors the key-matching logic in RateResolverService.tryRateTable:
   * case-insensitive column-name matching with id fallback.
   *
   * Returns null when no row matches — evaluateSteps will receive an empty
   * (or partial) values map, which surfaces missing-operand issues rather
   * than producing a plausible-looking wrong number.
   */
  private async findMatchedCells(
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

    // Build a normalised-key index so column-name matching is case-insensitive.
    const keysLower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(keys)) {
      keysLower[k.trim().toLowerCase()] = v;
    }

    const norm = (v: unknown): string =>
      v === undefined || v === null ? "" : String(v).trim().toLowerCase();

    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      // Only match on KEY columns — VALUE columns are not in `keys`.
      return cached.columns.every((c) => {
        if (!cached.keyColumnIds.has(c.id)) return true; // not a KEY — skip
        const colNameLower = c.name.trim().toLowerCase();
        const callerVal = keys[c.name] ?? keysLower[colNameLower] ?? keys[c.id];
        if (callerVal === undefined) return true; // caller did not supply this key
        return norm(cells[c.id]) === norm(callerVal);
      });
    });

    return match ? ((match.cells as Record<string, unknown> | null) ?? {}) : null;
  }
}
