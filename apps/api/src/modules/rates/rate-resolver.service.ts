import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { parseRatesCanonicalSource, RatesCanonicalSource } from "../../config/app.config";

export type RateSource = "legacy" | "ratetable";

export type ResolvedRate = {
  rowId: string;
  value: number;
  unit: string;
  source: RateSource;
};

/**
 * A single entry returned by `listRates`. Extends the resolver-shaped result
 * with `keys` so callers can (a) render a pick-list label and (b) feed the
 * keys directly back into `resolveRate`.
 *
 * `ResolvedRate` was not reused here because it carries no identifying key
 * information — the caller would know "value=450, unit=day" but not which
 * row it came from. Pick-list consumers need both the descriptive keys and
 * the value to render an option row and to round-trip the selection back
 * through `resolveRate`.
 *
 * `info` carries the INFO-role columns from the rate table (descriptive
 * metadata not used for pricing or key-matching). Always present; `{}`
 * when there are no INFO columns. Keyed by the RateTable column `name`
 * so both adapter paths expose the same key (e.g. `"Category"`).
 *
 * `isActive` mirrors the `isActive` column of the row the entry came from —
 * on every path, for every slug. It is a REPORT of the row's state, never a
 * filter: adding it changed no `where` clause and no returned row set.
 *
 * The two backing paths disagree about which rows they return, and that is
 * why the field exists. `tryListRateTable` pre-filters on
 * `isActive: true`, as do the `enclosure` and `other-rates` legacy adapters,
 * so those three paths only ever emit `isActive: true`. The other six legacy
 * adapters (labour, plant, waste, cutting, core-hole, fuel) apply no such
 * filter and emit inactive rows alongside active ones. So the row set of
 * `listRates(slug)` depends on both the slug and `RATES_CANONICAL_SOURCE`,
 * and `isActive` is currently the only way a caller can obtain the same
 * (active-only) row set from either path.
 *
 * A consumer that wants active rates only MUST filter explicitly —
 * `(await listRates(slug)).filter((r) => r.isActive)` — and must not assume
 * the resolver has already done it. Making the six unfiltered adapters
 * filter would change what existing consumers see (`rates-export.service.ts`
 * consumes `listRates("plant")`); that is a product decision filed for Marco
 * in `needs-marco/rates-11b2-consumer-migration-blockers-2026-08-27.md`.
 *
 * `sortOrder` mirrors the source row's sort column. Like `isActive` it is a
 * REPORT, never a filter and never an `orderBy`: adding it changed no `where`
 * and no `orderBy`, so `listRates(slug)` returns exactly the row sets, in
 * exactly the order, it returned before. The entries are NOT sorted by it.
 *
 * It exists because the curated business order it carries cannot be rebuilt
 * at the call site. `CuttingOtherRate`, for example, is seeded "Extra man"
 * (5), "Stand-down time" (6), "Clean-up time" (7) … "Overtime hourly charge
 * beyond minimum" (28), and the model carries `@@index([isActive, sortOrder])`
 * for it; alphabetical is a completely different sequence. A consumer that
 * wants that order must sort explicitly, exactly as the persona `lookup-rate`
 * handler's `orderBy: [{ sortOrder: "asc" }, { <field>: "asc" }]` does today.
 *
 * WHY IT IS NULLABLE. Eight of the nine backing models declare
 * `sortOrder Int @default(0) @map("sort_order")`: EstimateLabourRate,
 * EstimatePlantRate, EstimateWasteRate, EstimateCuttingRate,
 * EstimateFuelRate, EstimateEnclosureRate, CuttingOtherRate and RateRow.
 * `EstimateCoreHoleRate` — the `core-hole` slug — has NO sort column at all
 * (checked against `apps/api/prisma/schema.prisma` and every migration that
 * touches `estimate_core_hole_rates`). Its entries therefore report `null`,
 * not `0` and not an ordinal derived from array position: a fabricated order
 * is worse than an absent one, because the caller cannot tell it is
 * fabricated. `null` is legible — it says "this kind has no curated order,
 * use your own tie-break". No consumer needs one there today:
 * `availableCoreHoleDiameters()` orders by `{ diameterMm: "asc" }`, and is
 * with `availableCuttingCombinations()` one of only two `available*` helpers
 * that do not use `sortOrder`. Adding the column to `EstimateCoreHoleRate`
 * would be a schema change and a migration, which is not this slice.
 *
 * `fuelRate` (PLANT_FUEL_COLUMN_V1) is the plant hire item's running fuel
 * cost. It exists because `value` can carry exactly one figure and plant is
 * priced on two: `lookupPlant` returns `fuelRateAud` alongside `rateAud`, and
 * `tendering.persona.ts` instructs the model to report both because "the hire
 * rate alone understates the all-in plant cost". Without it the persona's
 * plant lookup cannot move to `listRates` and loses the number at cutover.
 *
 * A NAMED FIELD, NOT THE `info` BAG. `info` is documented above as
 * "descriptive metadata not used for pricing or key-matching", and Marco
 * ruled (2026-09-07) that the fuel rate is a VALUE column — a priced
 * quantity. Filing a priced quantity in the not-priced bag would be a false
 * statement about it, would hand the consumer `unknown` where it needs a
 * number, and on the RateTable path would require folding VALUE columns into
 * the INFO bag for every table. The legacy `waste` adapter does put its
 * second priced quantity in `info` (`info.loadRate`), and that is exactly the
 * shape that fails: `tryListRateTable` builds `info` from INFO-role columns
 * only, so `waste`'s "Rate per load" is absent on the RateTable path and the
 * figure is lost at cutover. Not repeating that here.
 *
 * WHY IT IS NULLABLE, and what each value means:
 *   - a number — the fuel figure for this row. `0` is a real, meaningful
 *     value: `EstimatePlantRate.fuelRate` is `Decimal @default(0)` and
 *     `estimates.service.ts` writes `dto.fuelRate ?? "0"`, so a plant item
 *     with no fuel cost recorded reports `0`, never `null`, on the legacy
 *     path. `null` there is unreachable by construction.
 *   - `null` — "this row has no fuel figure to report", which happens two
 *     ways: the slug has no `Fuel rate` VALUE column at all (every non-plant
 *     kind), or the RateTable row carries no cell for it (a row added through
 *     the admin UI after the migration and left blank). Reporting `0` for
 *     those would fabricate a fuel cost of zero dollars, which is a claim,
 *     not an absence — the same reason `sortOrder` is `null` for `core-hole`
 *     rather than a made-up `0`.
 * A non-numeric cell also reports `null` rather than `NaN`, so a consumer
 * that writes `fuelRate ?? fallback` cannot silently propagate `NaN` into a
 * price.
 *
 * Like `isActive` and `sortOrder` it is a REPORT: adding it changed no
 * `where` and no `orderBy`.
 */
/**
 * PLANT_FUEL_COLUMN_V1 — the `name` of the second VALUE column on the plant
 * rate table ("Fuel rate"), the running fuel cost an estimator adds on top of
 * the hire rate when an item is operated.
 *
 * THE NAME IS THE KEY, IN ALL THREE PLACES. `seed-initial-services.ts` upserts
 * the column on the unique `(rate_table_id, name)`; the
 * `20260907120000_rates_plant_fuel_column` migration resolves the column on
 * the same pair; and `tryListRateTable` below matches on it too. The literal
 * id `rt-plt-c-fuel` is stamped only in a create branch — a column created
 * through the admin UI carries a cuid under the same name, so id-keyed code
 * would silently miss it. Never key on the id.
 *
 * Matched across VALUE columns on ANY table, not gated on `slug === "plant"`:
 * the statement being made is "a VALUE column named 'Fuel rate' is a fuel
 * rate", which is true wherever it appears, and it keeps `tryListRateTable`
 * free of per-slug branching.
 */
export const PLANT_FUEL_COLUMN_NAME = "Fuel rate";

export type ListedRate = {
  rowId: string;
  keys: Record<string, unknown>;
  info: Record<string, unknown>;
  value: number;
  unit: string;
  /** The source row's `isActive` column, verbatim. Reported, never filtered on — see above. */
  isActive: boolean;
  /**
   * The source row's sort column, verbatim — `null` for `core-hole`, whose
   * backing model has no such column. Reported, never ordered by — see above.
   */
  sortOrder: number | null;
  /**
   * The row's fuel rate (PLANT_FUEL_COLUMN_V1) — `null` when the kind has no
   * `Fuel rate` VALUE column or the row carries no cell for it. `0` is a real
   * value and is NOT the same as `null`. Reported, never filtered or ordered
   * on — see above.
   */
  fuelRate: number | null;
  source: RateSource;
};

export type RateSetEntry = {
  key: string;
  rateTableId: string;
  rateTableSlug: string;
  label: string;
  unit: string | null;
  value: number;
};

export type RateParityResult = {
  slug: string;
  keys: Record<string, unknown>;
  legacy: ResolvedRate | { error: string } | null;
  ratetable: ResolvedRate | { error: string } | null;
  matches: boolean;
  divergence?: string;
};

/**
 * Single seam every future consumer will call: `resolveRate(slug, keys)`.
 * R0 reads from the eight legacy rate tables via a slug→adapter map so
 * pricing behaviour is byte-identical. New `RateTable` rows are also
 * resolvable, but no consumer is routed here yet (R1+).
 *
 * The legacy adapter map covers only the slugs the pricing paths already
 * use; unknown slugs fall through to the flexible `RateTable` model.
 *
 * Canonical-source cutover (`RATES_CANONICAL_SOURCE`):
 *   - `legacy` (default) — legacy first, RateTable fallback for unknown
 *     slugs. Byte-identical to pre-cutover behaviour.
 *   - `ratetable` — RateTable first, legacy fallback for slugs not yet
 *     modelled there. Flip only after `assertRateParity` shows clean
 *     agreement on a full pricing cycle in prod.
 */
@Injectable()
export class RateResolverService {
  private readonly logger = new Logger(RateResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveRate(
    tableSlug: string,
    keys: Record<string, unknown>,
    options?: { tenderId?: string }
  ): Promise<ResolvedRate> {
    // ── Snapshot check (ABOVE the canonical-source switch) ───────────────
    // If this tender has a locked rate set, try to serve the rate from it.
    // A snapshot key is {rateTableId}:{rowId}:{columnId}; we derive the
    // candidate key by finding the matching RateTable row for this slug +
    // keys, then check if that key exists in the snapshot entries.
    // This path is intentionally independent of RATES_CANONICAL_SOURCE
    // (snapshot rows are always RateTable-keyed).
    if (options?.tenderId) {
      const snapshot = await this.trySnapshot(options.tenderId, tableSlug, keys);
      if (snapshot !== null) return snapshot;
    }

    const source = this.getCanonicalSource();

    if (source === "ratetable") {
      const flexible = await this.tryRateTable(tableSlug, keys);
      if (flexible) return flexible;
      const legacy = await this.tryLegacy(tableSlug, keys);
      if (legacy) {
        this.logger.warn({
          event: "ratetable-miss-fell-back-to-legacy",
          slug: tableSlug,
          keys
        });
        return legacy;
      }
      throw new NotFoundException(
        `No rate table with slug "${tableSlug}" (canonical source: ratetable).`
      );
    }

    const legacy = await this.tryLegacy(tableSlug, keys);
    if (legacy) return legacy;
    const flexible = await this.tryRateTable(tableSlug, keys);
    if (flexible) return flexible;
    throw new NotFoundException(`No rate table with slug "${tableSlug}".`);
  }

  /**
   * Internal: attempt to resolve a rate from the tender's locked
   * TenderRateSet snapshot. Returns the resolved rate (with
   * `TENDER_RATE_SNAPSHOT_APPLIED` logged) when the key exists in the
   * snapshot; returns `null` when no snapshot exists for the tender or
   * the slug cannot be matched to a RateTable row. When a snapshot
   * EXISTS but the resolved key is ABSENT, logs
   * `snapshot-miss-fell-back-to-live` with the missing key so ops can
   * audit the gap — the caller then continues to live rate resolution.
   *
   * Key derivation: we resolve `{rateTableId}:{rowId}:{columnId}` using
   * the same KEY-column matching logic as `tryRateTable` (case-insensitive
   * col-name matching, first VALUE column). A slug not present in
   * RateTable at all (`null` from `tryRateTableKey`) means there are no
   * snapshot entries for this slug — that is a soft miss (no warning, no
   * fall-back log: the slug lives entirely in the legacy path).
   */
  private async trySnapshot(
    tenderId: string,
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<ResolvedRate | null> {
    // Load the snapshot entries for this tender. A miss means no snapshot.
    const rateSet = await this.prisma.tenderRateSet.findUnique({
      where: { tenderId },
      select: { id: true }
    });
    if (!rateSet) return null;

    const entries = await this.prisma.tenderRateEntry.findMany({
      where: { tenderRateSetId: rateSet.id }
    });
    // NOTE: do NOT return null for empty entries here — an empty snapshot
    // still means the tender HAS a snapshot, so a derivable key that is
    // absent from it should still emit snapshot-miss-fell-back-to-live.

    const entryByKey = new Map(
      entries.map((e) => [e.key, e] as const)
    );

    // Derive the candidate key by resolving the slug + keys against the
    // RateTable model. Returns { key, rowId, unit } or null when the slug
    // is not in RateTable (legacy-only slug — no warning needed).
    const candidate = await this.tryRateTableKey(tableSlug, keys);
    if (!candidate) {
      // Slug not modelled in RateTable at all — no snapshot entries can
      // exist for it. Fall through silently to live resolution.
      return null;
    }

    const entry = entryByKey.get(candidate.key);
    if (!entry) {
      // Snapshot exists for this tender but does not cover this key.
      // Log the miss so ops can see the gap, then fall back to live.
      this.logger.warn({
        event: "snapshot-miss-fell-back-to-live",
        tenderId,
        slug: tableSlug,
        candidateKey: candidate.key
      });
      return null;
    }

    // Snapshot hit. The effective value is overrideValue ?? originalValue.
    const effectiveValue =
      entry.overrideValue !== null && entry.overrideValue !== undefined
        ? Number(entry.overrideValue)
        : Number(entry.originalValue);

    this.logger.log({
      event: "TENDER_RATE_SNAPSHOT_APPLIED",
      tenderId,
      slug: tableSlug,
      key: candidate.key
    });

    return {
      rowId: candidate.rowId,
      value: effectiveValue,
      unit: candidate.unit,
      source: "ratetable"
    };
  }

  /**
   * Internal: resolve the `{rateTableId}:{rowId}:{columnId}` candidate
   * key for a given slug + keys without reading the snapshot. Returns
   * `{ key, rowId, unit }` on a match; returns `null` when the slug is
   * not present in RateTable or has no VALUE columns (the "try elsewhere"
   * signal — no warning). This is the same KEY-matching logic as
   * `tryRateTable`, extended to also return the composite key.
   */
  private async tryRateTableKey(
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<{ key: string; rowId: string; unit: string } | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table) return null;
    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const valueCols = table.columns.filter((c) => c.role === "VALUE");
    if (valueCols.length === 0) return null;

    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const keysLower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(keys)) {
      keysLower[k.trim().toLowerCase()] = v;
    }
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => {
        const colNameLower = c.name.trim().toLowerCase();
        const callerVal = keys[c.name] ?? keysLower[colNameLower] ?? keys[c.id];
        return norm(cells[c.id]) === norm(callerVal);
      });
    });
    if (!match) return null;

    const candidateKey = `${table.id}:${match.id}:${valueCols[0].id}`;
    return {
      key: candidateKey,
      rowId: match.id,
      unit: valueCols[0].unit ?? ""
    };
  }

  /**
   * Resolve the same key from BOTH sources and report whether they agree.
   * Used to prove — before flipping `RATES_CANONICAL_SOURCE` — that the
   * ratetable path answers identically to the legacy path. A divergence
   * here is a real bug in the seed or the ratetable model, not a test
   * failure to be "fixed".
   */
  async assertRateParity(
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<RateParityResult> {
    const legacy = await safeResolve(() => this.tryLegacy(tableSlug, keys));
    const ratetable = await safeResolve(() => this.tryRateTable(tableSlug, keys));

    if (isResolved(legacy) && isResolved(ratetable)) {
      const valueMatches = legacy.value === ratetable.value;
      const unitMatches = (legacy.unit ?? "") === (ratetable.unit ?? "");
      if (valueMatches && unitMatches) {
        return { slug: tableSlug, keys, legacy, ratetable, matches: true };
      }
      const parts: string[] = [];
      if (!valueMatches) parts.push(`value ${legacy.value} !== ${ratetable.value}`);
      if (!unitMatches) parts.push(`unit "${legacy.unit}" !== "${ratetable.unit}"`);
      return {
        slug: tableSlug,
        keys,
        legacy,
        ratetable,
        matches: false,
        divergence: parts.join("; ")
      };
    }

    return {
      slug: tableSlug,
      keys,
      legacy,
      ratetable,
      matches: false,
      divergence: describeMissing(legacy, ratetable)
    };
  }

  /**
   * Enumerate every active RateTable row × VALUE column as a flat list
   * of rate entries. The `key` — `{rateTableId}:{rowId}:{columnId}` — is
   * stable across snapshots so re-locking preserves overrides. Legacy
   * rate tables are not included; they lack a uniform enumerable shape.
   *
   * Reference tables (isReference=true) are factor / production data, not
   * priced rates — they are excluded here so they never appear as `$`
   * override rows in a locked tender snapshot.
   */
  async enumerateRateSet(): Promise<RateSetEntry[]> {
    const tables = await this.prisma.rateTable.findMany({
      where: { isReference: false },
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
    const entries: RateSetEntry[] = [];
    for (const table of tables) {
      const keyCols = table.columns.filter((c) => c.role === "KEY");
      const valueCols = table.columns.filter((c) => c.role === "VALUE");
      if (valueCols.length === 0) continue;
      const rows = await this.prisma.rateRow.findMany({
        where: { rateTableId: table.id, isActive: true },
        orderBy: { sortOrder: "asc" }
      });
      for (const row of rows) {
        const cells = (row.cells as Record<string, unknown> | null) ?? {};
        const keyLabel = keyCols
          .map((c) => {
            const v = cells[c.id] ?? cells[c.name];
            return v === undefined || v === null ? "" : String(v);
          })
          .filter((s) => s.length > 0)
          .join(" · ");
        for (const col of valueCols) {
          const raw = cells[col.id];
          const value = Number(raw);
          if (raw === undefined || raw === null || Number.isNaN(value)) continue;
          const key = `${table.id}:${row.id}:${col.id}`;
          const label =
            keyLabel.length > 0 ? `${table.name} — ${keyLabel} (${col.name})` : `${table.name} (${col.name})`;
          entries.push({
            key,
            rateTableId: table.id,
            rateTableSlug: table.slug,
            label,
            unit: col.unit ?? null,
            value
          });
        }
      }
    }
    return entries;
  }

  /**
   * List all active rates for the given slug, ordered stably so callers can
   * render a pick-list without re-sorting. Each entry carries the keys needed
   * to round-trip the selection back into `resolveRate`.
   *
   * Covers all eight legacy slugs: labour, plant, waste, cutting, core-hole,
   * fuel, enclosure, other-rates. Unknown slugs throw NotFoundException,
   * consistent with `resolveRate`.
   *
   * Snapshot precedence (SLICE 2 — SNAPSHOT_LIST_APPLIED):
   *   When `options.tenderId` is supplied and that tender has a locked
   *   TenderRateSet, the returned rows carry the snapshot's effectiveValue
   *   (overrideValue ?? originalValue) for any row matched by
   *   `{rateTableId}:{rowId}:{columnId}`. The check sits ABOVE
   *   `getCanonicalSource()` so it fires regardless of the
   *   RATES_CANONICAL_SOURCE setting — the same trap slice 1 documents.
   *   A per-row miss is a warn + live-value fallback; the list is never
   *   truncated. Logs `SNAPSHOT_LIST_APPLIED` (slug, tenderId, hitCount,
   *   missCount) so the next slice can gate on it.
   *
   * Canonical-source precedence mirrors `resolveRate`:
   *   - `ratetable` — RateTable first; falls back to legacy ONLY when the
   *     RateTable slug does not exist (or has zero VALUE columns). Emits a
   *     warn on fallback. If the slug IS registered in the RateTable, its
   *     rows are authoritative — returns [] if the table is empty.
   *   - `legacy` (default) — legacy first; falls back to RateTable ONLY when
   *     the slug is not registered in the legacy adapter (default branch).
   *     If the slug IS registered in the legacy adapter, its rows are
   *     authoritative — returns [] if the table has no rows.
   *
   * This diverges from `resolveRate`'s single-lookup semantics: "no rows for
   * slug X" is a valid empty state, whereas "slug X not registered" is the
   * "try elsewhere" signal. See PR body for rationale.
   *
   * For `labour`, three entries are emitted per row (day/night/weekend) so
   * callers receive the full rate matrix, consistent with the three separate
   * `resolveRate` calls a consumer would otherwise make per role.
   *
   * RateTable path uses `valueCols[0]` only, matching `resolveRate`'s
   * `tryRateTable` behaviour (not `enumerateRateSet`, which expands all VALUE
   * columns for snapshot purposes).
   */
  async listRates(tableSlug: string, options?: { tenderId?: string }): Promise<ListedRate[]> {
    // ── Snapshot check — ABOVE getCanonicalSource() ──────────────────────
    // Snapshot entries are RateTable-keyed ({rateTableId}:{rowId}:{columnId}).
    // A check nested inside the ratetable branch would do nothing when the
    // canonical source is legacy (default). This is the same trap slice 1
    // documents in resolveRate; we avoid it here by checking unconditionally.
    const snapshotEntries = options?.tenderId
      ? await this.loadSnapshotEntries(options.tenderId, tableSlug)
      : null;

    const source = this.getCanonicalSource();

    let liveRates: ListedRate[];
    if (source === "ratetable") {
      const fromRateTable = await this.tryListRateTable(tableSlug);
      if (fromRateTable !== null) {
        liveRates = fromRateTable;
      } else {
        const fromLegacy = await this.tryListLegacy(tableSlug);
        if (fromLegacy !== null) {
          this.logger.warn({
            event: "ratetable-miss-fell-back-to-legacy",
            slug: tableSlug,
            op: "listRates"
          });
          liveRates = fromLegacy;
        } else {
          throw new NotFoundException(
            `No rate table with slug "${tableSlug}" (canonical source: ratetable).`
          );
        }
      }
    } else {
      // Legacy-first (default).
      const fromLegacy = await this.tryListLegacy(tableSlug);
      if (fromLegacy !== null) {
        liveRates = fromLegacy;
      } else {
        const fromRateTable = await this.tryListRateTable(tableSlug);
        if (fromRateTable !== null) {
          liveRates = fromRateTable;
        } else {
          throw new NotFoundException(`No rate table with slug "${tableSlug}".`);
        }
      }
    }

    if (!snapshotEntries || snapshotEntries.size === 0) return liveRates;
    return this.applySnapshotToList(liveRates, snapshotEntries, tableSlug, options!.tenderId!);
  }

  /**
   * Load TenderRateEntry rows for a given tender + slug combination into a
   * Map keyed by `{rowId}:{columnId}` (the rateTableId prefix is stripped
   * because listRates matches by rowId — the table slug already scopes the
   * lookup). Returns null when the tender has no locked TenderRateSet.
   *
   * Key format from enumerateRateSet / lock(): `{rateTableId}:{rowId}:{columnId}`.
   * We strip the rateTableId prefix so callers can look up by `{rowId}:{columnId}`.
   */
  private async loadSnapshotEntries(
    tenderId: string,
    tableSlug: string
  ): Promise<Map<string, number> | null> {
    const set = await this.prisma.tenderRateSet.findUnique({
      where: { tenderId },
      select: { id: true }
    });
    if (!set) return null;

    const entries = await this.prisma.tenderRateEntry.findMany({
      where: { tenderRateSetId: set.id, rateTableSlug: tableSlug }
    });
    if (entries.length === 0) return null;

    const byRowColKey = new Map<string, number>();
    for (const entry of entries) {
      // key = "{rateTableId}:{rowId}:{columnId}" — strip rateTableId prefix.
      const parts = entry.key.split(":");
      if (parts.length < 3) continue;
      const rowColKey = `${parts[1]}:${parts[2]}`;
      const effectiveValue = entry.overrideValue ?? entry.originalValue;
      byRowColKey.set(rowColKey, Number(effectiveValue));
    }
    return byRowColKey;
  }

  /**
   * Overlay snapshot values onto a live rate list. For each listed row:
   *   - If the snapshot has a `{rowId}:{columnId}` match, use the snapshot
   *     value (overrideValue ?? originalValue).
   *   - If no match, warn with `snapshot-list-miss-fell-back-to-live` and
   *     keep the live value.
   *
   * The list is never truncated — every live row is returned. Logs
   * `SNAPSHOT_LIST_APPLIED` with summary counts.
   *
   * NOTE: legacy adapter paths do not carry a `columnId` in the snapshot
   * key (legacy rates have no RateTable column). For those slugs the
   * snapshot entries will always miss (the slug maps to a legacy table that
   * enumerateRateSet excludes). That is by design: only RateTable-backed
   * slugs can be locked.
   */
  private applySnapshotToList(
    liveRates: ListedRate[],
    snapshotEntries: Map<string, number>,
    tableSlug: string,
    tenderId: string
  ): ListedRate[] {
    let hitCount = 0;
    let missCount = 0;

    const result = liveRates.map((row) => {
      // Build every possible {rowId}:{columnId} key for this row.
      // For RateTable-backed rows the snapshot map holds exactly one value
      // column per row (valueCols[0] from tryListRateTable, which mirrors
      // enumerateRateSet's column enumeration). We do not know the columnId
      // here, so we scan all entries whose key starts with `{rowId}:`.
      let snapshotValue: number | undefined;
      for (const [key, value] of snapshotEntries) {
        if (key.startsWith(`${row.rowId}:`)) {
          snapshotValue = value;
          break;
        }
      }

      if (snapshotValue !== undefined) {
        hitCount += 1;
        return { ...row, value: snapshotValue };
      }

      missCount += 1;
      this.logger.warn({
        event: "snapshot-list-miss-fell-back-to-live",
        slug: tableSlug,
        tenderId,
        rowId: row.rowId
      });
      return row;
    });

    this.logger.log({
      event: "SNAPSHOT_LIST_APPLIED",
      slug: tableSlug,
      tenderId,
      hitCount,
      missCount
    });

    return result;
  }

  /**
   * Internal: list rates from the flexible RateTable model.
   * Returns null when the slug does not exist in RateTable or has no VALUE
   * columns (matching tryRateTable's `if (valueCols.length === 0) return null`).
   * Returns [] when the slug exists but has no active rows — that is a
   * valid empty state, not a miss.
   */
  private async tryListRateTable(tableSlug: string): Promise<ListedRate[] | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
    if (!table) return null;
    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const infoCols = table.columns.filter((c) => c.role === "INFO");
    const valueCols = table.columns.filter((c) => c.role === "VALUE");
    if (valueCols.length === 0) return null;
    // Use valueCols[0] only — matches resolveRate's tryRateTable behaviour.
    const valueCol = valueCols[0];
    // PLANT_FUEL_COLUMN_V1 — the second priced quantity. Found by column
    // NAME, the same key the seed and the migration use, never by the literal
    // id `rt-plt-c-fuel` (an admin-UI column carries a cuid under that name).
    // `undefined` on every table that has no such column, which is every kind
    // but plant; those rows report `fuelRate: null`.
    const fuelCol = valueCols.find((c) => c.name === PLANT_FUEL_COLUMN_NAME);
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true },
      orderBy: { sortOrder: "asc" }
    });
    return rows.map((row) => {
      const cells = (row.cells as Record<string, unknown> | null) ?? {};
      const keys: Record<string, unknown> = {};
      for (const col of keyCols) {
        const val = cells[col.id] ?? cells[col.name];
        keys[col.name] = val ?? null;
      }
      const info: Record<string, unknown> = {};
      for (const col of infoCols) {
        const val = cells[col.id] ?? cells[col.name];
        info[col.name] = val ?? null;
      }
      // Cell absent (or non-numeric) => null, never 0 and never NaN: `0` is a
      // real fuel rate and must not be fabricated for a row that simply has
      // no cell. `cells[col.id] ?? cells[col.name]` mirrors the KEY/INFO
      // readers above, which tolerate both keyings.
      let fuelRate: number | null = null;
      if (fuelCol) {
        const rawFuel = cells[fuelCol.id] ?? cells[fuelCol.name];
        if (rawFuel !== undefined && rawFuel !== null) {
          const n = Number(rawFuel);
          fuelRate = Number.isNaN(n) ? null : n;
        }
      }
      return {
        rowId: row.id,
        keys,
        info,
        value: Number(cells[valueCol.id]),
        unit: valueCol.unit ?? "",
        // Read from the column, not hard-coded true: the findMany above
        // pre-filters isActive: true so this is always true today, but the
        // field stays honest if that `where` is ever relaxed.
        isActive: row.isActive,
        // RateRow declares `sortOrder Int @default(0)`, and the findMany above
        // already orders by it; reading the column changes neither.
        sortOrder: row.sortOrder,
        fuelRate,
        source: "ratetable" as const
      };
    });
  }

  /**
   * Internal: list rates from the legacy adapter map.
   * Returns null when the slug is not registered (default branch) — the
   * "try elsewhere" signal. Returns [] when the slug is registered but has
   * no rows — that is a valid empty state.
   */
  private async tryListLegacy(slug: string): Promise<ListedRate[] | null> {
    switch (slug) {
      case "labour": {
        const rows = await this.prisma.estimateLabourRate.findMany({
          orderBy: { role: "asc" }
        });
        const entries: ListedRate[] = [];
        for (const row of rows) {
          // All three shift entries come from the same row, so all three
          // report that row's isActive and that row's sortOrder.
          entries.push(
            { rowId: row.id, keys: { role: row.role, shift: "day" }, info: {}, value: Number(row.dayRate), unit: "day", isActive: row.isActive, sortOrder: row.sortOrder, fuelRate: null, source: "legacy" },
            { rowId: row.id, keys: { role: row.role, shift: "night" }, info: {}, value: Number(row.nightRate), unit: "day", isActive: row.isActive, sortOrder: row.sortOrder, fuelRate: null, source: "legacy" },
            { rowId: row.id, keys: { role: row.role, shift: "weekend" }, info: {}, value: Number(row.weekendRate), unit: "day", isActive: row.isActive, sortOrder: row.sortOrder, fuelRate: null, source: "legacy" }
          );
        }
        return entries;
      }
      case "plant": {
        const rows = await this.prisma.estimatePlantRate.findMany({
          orderBy: { item: "asc" }
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { item: row.item },
          // INFO columns keyed by RateTable column name so both adapter paths
          // expose the same key. Blank category stays as "" — consumers must
          // guard against empty string (seed writes category: row.category ?? "").
          info: { Category: row.category ?? "", Unit: row.unit },
          value: Number(row.rate),
          unit: row.unit,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          // PLANT_FUEL_COLUMN_V1 — the running fuel cost, reported alongside
          // the hire rate. `fuelRate` is `Decimal @default(0)` and NOT
          // nullable, and estimates.service.ts writes `dto.fuelRate ?? "0"`,
          // so this branch always yields a number: `0` for an item with no
          // fuel cost recorded, never null. Converted with Number() exactly
          // like the adjacent `value: Number(row.rate)`.
          fuelRate: Number(row.fuelRate),
          source: "legacy" as const
        }));
      }
      case "waste": {
        const rows = await this.prisma.estimateWasteRate.findMany({
          orderBy: [{ wasteType: "asc" }, { facility: "asc" }]
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { wasteType: row.wasteType, facility: row.facility },
          // INFO columns keyed by RateTable column name so both adapter paths
          // expose the same key. wasteGroup is String? — null is carried
          // through (do NOT coerce to ""); export callers must guard.
          // loadRate is Decimal @default(0); convert with Number() consistent
          // with the adjacent value: Number(row.tonRate) conversion.
          info: { wasteGroup: row.wasteGroup, loadRate: Number(row.loadRate) },
          value: Number(row.tonRate),
          unit: row.unit,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          // No fuel concept on this kind — see the ListedRate doc comment.
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      case "cutting": {
        const rows = await this.prisma.estimateCuttingRate.findMany({
          orderBy: [
            { equipment: "asc" },
            { elevation: "asc" },
            { material: "asc" },
            { depthMm: "asc" }
          ]
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: {
            equipment: row.equipment,
            elevation: row.elevation,
            material: row.material,
            depthMm: row.depthMm
          },
          info: {},
          value: Number(row.ratePerM),
          unit: "m",
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      case "core-hole": {
        const rows = await this.prisma.estimateCoreHoleRate.findMany({
          orderBy: { diameterMm: "asc" }
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { diameterMm: row.diameterMm },
          info: {},
          value: Number(row.ratePerHole),
          unit: "hole",
          isActive: row.isActive,
          // EstimateCoreHoleRate is the ONLY backing model with no sort
          // column — see the ListedRate doc comment. Reported as null rather
          // than defaulted to 0 or derived from array position, so a caller
          // can tell there is no curated order here instead of trusting a
          // fabricated one. Making this a number means a migration.
          sortOrder: null,
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      case "fuel": {
        const rows = await this.prisma.estimateFuelRate.findMany({
          orderBy: { item: "asc" }
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { item: row.item },
          info: {},
          value: Number(row.rate),
          unit: row.unit,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      case "enclosure": {
        const rows = await this.prisma.estimateEnclosureRate.findMany({
          where: { isActive: true },
          orderBy: { enclosureType: "asc" }
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { enclosureType: row.enclosureType },
          info: {},
          value: Number(row.rate),
          unit: row.unit,
          // Pre-filtered to isActive: true by the `where` above; read from the
          // column anyway so the field never disagrees with the row.
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      case "other-rates": {
        const rows = await this.prisma.cuttingOtherRate.findMany({
          where: { isActive: true },
          orderBy: { description: "asc" }
        });
        return rows.map((row) => ({
          rowId: row.id,
          keys: { description: row.description },
          info: {},
          value: Number(row.rate),
          unit: row.unit,
          // Pre-filtered to isActive: true by the `where` above; read from the
          // column anyway so the field never disagrees with the row.
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          fuelRate: null,
          source: "legacy" as const
        }));
      }
      default:
        return null;
    }
  }

  /**
   * Read a named numeric metric from a reference RateTable. Unlike
   * `resolveRate` (which returns the first VALUE column and is used by
   * priced consumers) this lets calculators pull a specific factor out of a
   * multi-metric factor row — e.g. the "Excavating" metric from the
   * excavator-production table. Returns `null` on any miss so callers can
   * choose a fallback without wrapping in try/catch.
   */
  async resolveReferenceValue(
    tableSlug: string,
    keys: Record<string, unknown>,
    columnName: string
  ): Promise<number | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table || !table.isReference) return null;

    const wanted = columnName.trim().toLowerCase();
    const col = table.columns.find((c) => c.name.trim().toLowerCase() === wanted);
    if (!col) return null;

    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => norm(cells[c.id]) === norm(keys[c.name] ?? keys[c.id]));
    });
    if (!match) return null;
    const raw = ((match.cells as Record<string, unknown>) ?? {})[col.id];
    if (raw === undefined || raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  /**
   * List every material density row, ordered as the estimating UI
   * expects (active first, then category, then material name).
   *
   * Reads from `EstimateMaterialDensity` — the legacy model is still
   * write-authoritative for THIS PR (deprecate-in-place). Callers
   * that previously hit prisma directly should route here so that when
   * the storage flips to `RateTable` in the follow-up PR they need no
   * further change.
   *
   * Byte-identical to a direct `prisma.estimateMaterialDensity.findMany`
   * with the same ordering.
   */
  async listMaterialDensities() {
    return this.prisma.estimateMaterialDensity.findMany({
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { materialName: "asc" }]
    });
  }

  /**
   * Single-material density lookup for pricing / waste-weight paths.
   * Returns `null` on any miss so callers can pick a fallback without
   * wrapping in try/catch.
   *
   * SLICE 11a: when RATES_CANONICAL_SOURCE=ratetable, RateTable is queried
   * first so density lookups resolve from the canonical store without
   * touching the legacy table. Legacy remains the fallback for the
   * deprecate-in-place window. When canonical=legacy (default), legacy is
   * tried first with RateTable as fallback — preserving pre-11a behaviour.
   *
   * Density is returned as `Number(row.density)` — the same conversion
   * every existing consumer uses — so numbers are byte-identical to
   * the pre-cutover lookup.
   */
  async resolveMaterialDensity(
    materialName: string
  ): Promise<{ density: number; unit: string; kind: string; category: string | null } | null> {
    const source = this.getCanonicalSource();

    if (source === "ratetable") {
      // Canonical path: RateTable first, legacy fallback.
      const fromTable = await this.resolveMaterialDensityFromRateTable(materialName);
      if (fromTable) return fromTable;
      const legacyFallback = await this.prisma.estimateMaterialDensity.findUnique({
        where: { materialName }
      });
      if (!legacyFallback) return null;
      return {
        density: Number(legacyFallback.density),
        unit: legacyFallback.unit,
        kind: String(legacyFallback.kind),
        category: legacyFallback.category
      };
    }

    // Legacy-first (default) — byte-identical to pre-11a behaviour.
    const legacy = await this.prisma.estimateMaterialDensity.findUnique({
      where: { materialName }
    });
    if (legacy) {
      return {
        density: Number(legacy.density),
        unit: legacy.unit,
        kind: String(legacy.kind),
        category: legacy.category
      };
    }
    return this.resolveMaterialDensityFromRateTable(materialName);
  }

  /**
   * Internal: resolve a density from the material-densities RateTable.
   * Shared by both canonical paths of resolveMaterialDensity.
   */
  private async resolveMaterialDensityFromRateTable(
    materialName: string
  ): Promise<{ density: number; unit: string; kind: string; category: string | null } | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: "material-densities" },
      include: { columns: true }
    });
    if (!table) return null;
    const byKey = new Map(table.columns.map((c) => [c.name.toLowerCase(), c] as const));
    const materialCol = byKey.get("material");
    const densityCol = byKey.get("density");
    const unitCol = byKey.get("unit");
    const kindCol = byKey.get("kind");
    const categoryCol = byKey.get("category");
    if (!materialCol || !densityCol) return null;

    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const wanted = materialName.trim().toLowerCase();
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      const v = cells[materialCol.id] ?? cells[materialCol.name];
      return String(v ?? "").trim().toLowerCase() === wanted;
    });
    if (!match) return null;
    const cells = (match.cells as Record<string, unknown> | null) ?? {};
    const density = Number(cells[densityCol.id]);
    if (!Number.isFinite(density)) return null;
    return {
      density,
      unit: unitCol ? String(cells[unitCol.id] ?? "") : "",
      kind: kindCol ? String(cells[kindCol.id] ?? "") : "VOLUME",
      category: categoryCol
        ? (String(cells[categoryCol.id] ?? "") || null)
        : null
    };
  }

  private getCanonicalSource(): RatesCanonicalSource {
    return parseRatesCanonicalSource(process.env.RATES_CANONICAL_SOURCE);
  }

  private async tryRateTable(
    tableSlug: string,
    keys: Record<string, unknown>
  ): Promise<ResolvedRate | null> {
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: true }
    });
    if (!table) return null;
    const keyCols = table.columns.filter((c) => c.role === "KEY");
    const valueCols = table.columns.filter((c) => c.role === "VALUE");
    if (valueCols.length === 0) return null;
    const rows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    // Build a normalised-key index of the caller's keys so column name
    // matching is case-insensitive (e.g. column "Role" matches key "role").
    // Callers use camelCase or snake_case field names from the legacy schema;
    // column names in the DB use title-case display names. We check all three
    // variants in priority order: exact name, lowercase name, column id.
    const keysLower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(keys)) {
      keysLower[k.trim().toLowerCase()] = v;
    }
    const match = rows.find((r) => {
      const cells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyCols.every((c) => {
        const colNameLower = c.name.trim().toLowerCase();
        const callerVal = keys[c.name] ?? keysLower[colNameLower] ?? keys[c.id];
        return norm(cells[c.id]) === norm(callerVal);
      });
    });
    if (!match) return null;
    const value = Number(((match.cells as Record<string, unknown>) ?? {})[valueCols[0].id]);
    return {
      rowId: match.id,
      value,
      unit: valueCols[0].unit ?? "",
      source: "ratetable"
    };
  }

  private async tryLegacy(slug: string, keys: Record<string, unknown>): Promise<ResolvedRate | null> {
    switch (slug) {
      case "labour": {
        const role = String(keys.role ?? "");
        const shift = String(keys.shift ?? "day");
        const row = await this.prisma.estimateLabourRate.findUnique({ where: { role } });
        if (!row) return null;
        const rate =
          shift === "night" ? row.nightRate : shift === "weekend" ? row.weekendRate : row.dayRate;
        return { rowId: row.id, value: Number(rate), unit: "day", source: "legacy" };
      }
      case "plant": {
        const item = String(keys.item ?? "");
        const row = await this.prisma.estimatePlantRate.findUnique({ where: { item } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      case "waste": {
        const wasteType = String(keys.wasteType ?? "");
        const facility = String(keys.facility ?? "");
        const row = await this.prisma.estimateWasteRate.findUnique({
          where: { wasteType_facility: { wasteType, facility } }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.tonRate), unit: row.unit, source: "legacy" };
      }
      case "cutting": {
        const equipment = String(keys.equipment ?? "");
        const elevation = String(keys.elevation ?? "");
        const material = String(keys.material ?? "");
        const depthMm = Number(keys.depthMm ?? 0);
        const row = await this.prisma.estimateCuttingRate.findUnique({
          where: {
            equipment_elevation_material_depthMm: { equipment, elevation, material, depthMm }
          }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.ratePerM), unit: "m", source: "legacy" };
      }
      case "core-hole": {
        const diameterMm = Number(keys.diameterMm ?? 0);
        const row = await this.prisma.estimateCoreHoleRate.findUnique({ where: { diameterMm } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.ratePerHole), unit: "hole", source: "legacy" };
      }
      case "fuel": {
        const item = String(keys.item ?? "");
        const row = await this.prisma.estimateFuelRate.findUnique({ where: { item } });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      case "enclosure": {
        // SLICE 11a: enclosure is now registered in the resolver so the
        // fallback-audit can route it through resolveRate. Previously it
        // was accessed directly via prisma.estimateEnclosureRate in
        // lookup-rate.handler.ts and had no resolver slug.
        const enclosureType = String(keys.enclosureType ?? "");
        const row = await this.prisma.estimateEnclosureRate.findFirst({
          where: { enclosureType, isActive: true }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      case "other-rates": {
        // SLICE 11a: other-rates maps to CuttingOtherRate. Key = description
        // (unique enough for the small admin catalogue). Returns the first
        // active matching row.
        const description = String(keys.description ?? "");
        const row = await this.prisma.cuttingOtherRate.findFirst({
          where: { description, isActive: true }
        });
        if (!row) return null;
        return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
      }
      default:
        return null;
    }
  }
}

function norm(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().toLowerCase();
}

async function safeResolve(
  fn: () => Promise<ResolvedRate | null>
): Promise<ResolvedRate | { error: string } | null> {
  try {
    return await fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function isResolved(
  x: ResolvedRate | { error: string } | null
): x is ResolvedRate {
  return x !== null && !(typeof x === "object" && "error" in x);
}

function describeMissing(
  legacy: ResolvedRate | { error: string } | null,
  ratetable: ResolvedRate | { error: string } | null
): string {
  const legDesc = legacy === null ? "missing" : "error" in legacy ? `error(${legacy.error})` : "ok";
  const rtDesc =
    ratetable === null ? "missing" : "error" in ratetable ? `error(${ratetable.error})` : "ok";
  return `legacy=${legDesc}, ratetable=${rtDesc}`;
}
