import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Prisma, QuoteDestination } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { ChargeStepPricingService } from "../rates/charge-step-pricing.service";
import { cuttingLineTotal } from "./cutting-line-pricing";
import type { Discipline } from "./dto/scope-of-works.dto";
import { DISCIPLINES } from "./dto/scope-of-works.dto";
import {
  buildRateMaps,
  computeScopeItemTotal,
  computeOperationalLineMarkup,
  computeOperationalLineTotal,
  decToNum,
  resolveEffectiveMarkup,
  toPricingInput
} from "./scope-item-pricing";

/**
 * SCOPE_OPERATIONAL_COSTS_PRICED_V1 -- marker that operational-cost lines
 * now contribute to tenderPrice as an independently marked-up fourth stream.
 *
 * S2 arms only when this string is on main.
 */
export const SCOPE_OPERATIONAL_COSTS_PRICED_V1 = "scopecards-s1";

/**
 * SCOPE_QUOTE_DESTINATION_V1 -- marker that every estimating line now carries
 * one destination (PRICE / PROVISIONAL / OPTION / INTERNAL). The three legacy
 * switches - covered-item zeroing, the provisional flag, the discipline OR-rule -
 * are replaced by
 * this single column. S2b arms only when this string is on main.
 */
export const SCOPE_QUOTE_DESTINATION_V1 = "scopecards-s2a";

/**
 * SCOPE_LINE_MARKUP_ALL_TYPES_V1 -- marker that waste and cutting lines each
 * carry a per-line markupOverride resolved via resolveEffectiveMarkup(
 *   line.markupOverride, card.<section>MarkupOverride, tenderMarkup
 * ). S3 arms only when this string is on main.
 */
export const SCOPE_LINE_MARKUP_ALL_TYPES_V1 = "scopecards-s3";

// ── Column availability map ─────────────────────────────────────────────
// Required columns are always rendered. Optional columns are opt-in via
// ScopeViewConfig, but only become visible in the UI when the selected
// row type lists them as available (so a `plant-only` row doesn't show
// empty cells for "men" etc.).

/**
 * Columns that are always rendered for every row type — never part of
 * the optional ScopeViewConfig column set.
 */
export const REQUIRED_COLUMNS = ["wbsCode", "description", "rowType"] as const;

const COLUMNS_BY_ROW_TYPE: Record<string, string[]> = {
  demolition: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  "asbestos-removal": ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  enclosure: ["men", "days", "measurementQty", "measurementUnit", "material", "notes"],
  excavation: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  earthworks: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  "waste-disposal": ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  "plant-only": ["plantAssetId", "days", "notes"],
  "general-labour": ["men", "days", "shift", "notes"],
  cutting: ["notes"],
  // Legacy row-type aliases — kept so old rows keep resolving to a
  // sensible column set when the UI asks for availability.
  asbestos: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  waste: ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  general: ["men", "days", "shift", "notes"]
};

// Row-type × discipline matrix (server-authoritative).
const ROW_TYPES_BY_DISCIPLINE: Record<Discipline, string[]> = {
  DEM: ["demolition", "waste-disposal", "plant-only", "general-labour", "cutting"],
  CIV: ["excavation", "earthworks", "waste-disposal", "plant-only", "general-labour", "cutting"],
  ASB: ["asbestos-removal", "enclosure", "waste-disposal", "plant-only", "general-labour"],
  // SUB carries subcontracted work priced against the quote received.
  // Row types mirror DEM minus cutting (cutting is typically quoted separately
  // by the subcontractor and captured as a SUB line).
  SUB: ["demolition", "waste-disposal", "plant-only", "general-labour"],
  Other: ["waste-disposal", "plant-only", "general-labour", "cutting"]
};

// Legacy aliases acceptable on any discipline the matrix allows.
const LEGACY_ROW_TYPES = new Set(["demolition", "cutting", "asbestos", "excavation", "waste", "general"]);

/**
 * Validates that a rowType is allowed for the given discipline per the
 * server-authoritative matrix, accepting legacy row-type aliases on any
 * discipline.
 *
 * @param discipline - discipline code keyed into ROW_TYPES_BY_DISCIPLINE
 * @param rowType - row type to validate
 * @throws BadRequestException when the discipline is unknown or the rowType is not allowed for it
 */
export function assertRowTypeForDiscipline(discipline: Discipline, rowType: string): void {
  const allowed = ROW_TYPES_BY_DISCIPLINE[discipline];
  if (!allowed) throw new BadRequestException(`Unknown discipline "${discipline}".`);
  if (allowed.includes(rowType)) return;
  if (LEGACY_ROW_TYPES.has(rowType)) return;
  throw new BadRequestException(
    `Row type "${rowType}" is not valid for discipline "${discipline}". Allowed: ${allowed.join(", ")}.`
  );
}

/**
 * Resolves the available + required column sets for a row type.
 *
 * @param rowType - row type keyed into COLUMNS_BY_ROW_TYPE (legacy aliases included)
 * @returns `{ available, required }` column-name arrays
 * @throws BadRequestException when the rowType is unknown
 */
export function columnsForRowType(rowType: string) {
  const available = COLUMNS_BY_ROW_TYPE[rowType];
  if (!available) {
    throw new BadRequestException(`Unknown rowType "${rowType}".`);
  }
  return { available, required: [...REQUIRED_COLUMNS] };
}

// Default "optional columns on" for a discipline — union of all its
// row types' column sets (excluding required columns).
function defaultColumnsForDiscipline(discipline: Discipline): string[] {
  const union = new Set<string>();
  for (const rt of ROW_TYPES_BY_DISCIPLINE[discipline] ?? []) {
    for (const col of COLUMNS_BY_ROW_TYPE[rt] ?? []) union.add(col);
  }
  return Array.from(union).filter((c) => !(REQUIRED_COLUMNS as readonly string[]).includes(c));
}

// Server-enforced per-equipment method allowlist. Anything outside the
// allowlist is coerced to null (no multiplier) so a stale or malformed
// client request can't ask for a rate combination that doesn't exist in
// the Cutrite schedule.
const METHODS_BY_EQUIPMENT: Record<string, Set<string>> = {
  Roadsaw: new Set(["Fuel", "Low-emission"]),
  Demosaw: new Set(["High-Freq", "Fuel"]),
  Ringsaw: new Set(["High-Freq", "Fuel"]),
  "Flush-cut": new Set(["High-Freq", "Fuel"]),
  Tracksaw: new Set(["Fuel"])
};

// Saw cuts cap at Wall — Inverted only applies to core holes. If a stale
// frontend sends Inverted on a saw cut we collapse to Floor so the rate
// still resolves against a Floor-rowed rate table.
function sanitiseSawElevation(equipment: string, elevation: string): string {
  if (equipment === "Roadsaw") return "Floor"; // Roadsaw is Floor-only per Cutrite
  if (elevation === "Inverted") return "Floor";
  return elevation;
}

const ANY_ELEVATION_EQUIPMENT = new Set(["Flush-cut", "Ringsaw", "Tracksaw"]);
const ANY_MATERIAL_EQUIPMENT = new Set(["Flush-cut", "Ringsaw", "Tracksaw"]);

// User-facing material labels → Cutrite table material values. Scope rows
// use strings like "Concrete (unreinforced)"; the rate table only stores
// three categorical values.
function mapUserMaterial(raw: string | null | undefined): string {
  if (!raw) return "Concrete";
  const s = raw.toLowerCase();
  if (s.includes("asphalt")) return "Asphalt";
  if (s.includes("brick") || s.includes("block") || s.includes("masonry")) return "Brick/Block";
  return "Concrete";
}

/**
 * PR B4b — best-effort material inference for the cutting "Copy from
 * above" aggregator. Walks the scope item's fields in priority order
 * (material → materialType → description) and returns the first
 * categorical match. Returns null when no confident match — the
 * frontend renders the row with an amber border to prompt the
 * estimator to pick manually. Deliberately does NOT default to
 * "Concrete" (Marco's locked answer #1): silent defaults hide
 * misclassifications and the cutting rate matrix produces wildly
 * different rates per material.
 *
 * The three return values match the cutting rate-table material
 * vocabulary, NOT the discipline-code vocabulary (DEM/CIV/ASB/Other).
 */
export function inferCuttingMaterial(item: {
  material?: string | null;
  materialType?: string | null;
  description?: string | null;
}): "Concrete" | "Masonry" | "Asphalt" | null {
  const candidates = [item.material, item.materialType, item.description]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => v.toLowerCase());
  for (const candidate of candidates) {
    if (candidate.includes("asphalt")) return "Asphalt";
    if (candidate.includes("brick") || candidate.includes("block") || candidate.includes("masonry")) {
      return "Masonry";
    }
    if (candidate.includes("concrete")) return "Concrete";
  }
  return null;
}

/**
 * CHARGE_STEPS_PRICE_CUTTING_V1 — Cutting rate resolver using charge steps.
 *
 * Row selection (sanitiseSawElevation, METHODS_BY_EQUIPMENT, elevation/material
 * collapse, depth range match + biggest-available fallback) stays in this function.
 * These choose WHICH row answers the request; the step grammar has no row selection.
 *
 * After the row is chosen, `chargeStepPricing.priceRow()` runs the formula.
 * - Tracksaw and Flush-cut route to the `cutting-mm` table (depth-scaling steps).
 * - Everything else routes to `cutting`.
 *
 * When `chargeStepPricing` is not provided (unit-test compat), the baseRate is
 * returned as finalRate with no multipliers (methodMultiplier=1.0, elevationMultiplier=1.0).
 *
 * Returned shape unchanged. `elevationMultiplier` is always 1.0 — elevation premium
 * is encoded in priced Wall rows, not a multiplier. `methodMultiplier` is reported
 * from the step trail (the factor applied by the method conditional step), 1.0 when
 * the condition was skipped or no steps were provided.
 *
 * rates-consumers SLICE 2 — uses RateResolverService.listRates so canonical-source
 * routing is honoured and locked-rate snapshots are applied.
 */
export async function resolveCuttingRate(
  rateResolver: RateResolverService,
  input: {
    equipment: string;
    elevation: string;
    material: string;
    depthMm: number;
    method?: string | null;
    tenderId?: string | null;
  },
  chargeStepPricing?: ChargeStepPricingService | null
): Promise<{ baseRate: number; methodMultiplier: number; elevationMultiplier: number; finalRate: number } | null> {
  const { equipment, depthMm } = input;

  // Sanitise the inbound elevation against the saw-cut rule that Inverted
  // only applies to core holes. Roadsaw is additionally pinned to Floor.
  // These stay in code: they choose which row answers the request; the step
  // grammar has no row selection.
  const requestedElevation = sanitiseSawElevation(equipment, input.elevation);

  // Method allowlist per equipment (Roadsaw doesn't support High-Freq,
  // Tracksaw doesn't support High-Freq, etc). Unsupported methods are
  // dropped rather than raising — the client may be stale.
  const allowed = METHODS_BY_EQUIPMENT[equipment] ?? new Set<string>();
  const effectiveMethod = input.method && allowed.has(input.method) ? input.method : null;

  // Steps 1 + 2 — collapse elevation/material into the table's three-level
  // categorical set. This mirrors the rate-library layout: Demosaw has
  // separate Floor/Any and Wall/{Concrete,Brick/Block} rows; Roadsaw has
  // Floor/{Concrete,Asphalt}; everything else is Any/Any.
  let effectiveElevation = requestedElevation;
  let effectiveMaterial = mapUserMaterial(input.material);

  if (ANY_ELEVATION_EQUIPMENT.has(equipment)) {
    effectiveElevation = "Any";
    effectiveMaterial = ANY_MATERIAL_EQUIPMENT.has(equipment) ? "Any" : effectiveMaterial;
  } else if (equipment === "Demosaw") {
    if (requestedElevation === "Floor") {
      effectiveElevation = "Floor";
      effectiveMaterial = "Any";
    } else {
      effectiveElevation = "Wall";
      if (effectiveMaterial !== "Brick/Block") effectiveMaterial = "Concrete";
    }
  } else if (equipment === "Roadsaw") {
    effectiveElevation = "Floor";
    effectiveMaterial = effectiveMaterial === "Asphalt" ? "Asphalt" : "Concrete";
  }

  // CHARGE_STEPS_PRICE_CUTTING_V1: Tracksaw and Flush-cut route to the
  // cutting-mm table (depth-scaling formula in steps). All others use cutting.
  const isDepthScaled = equipment === "Tracksaw" || equipment === "Flush-cut";
  const tableSlug = isDepthScaled ? "cutting-mm" : "cutting";

  // Step 3 — effective depth. Row selection from the cutting table.
  // Pass tenderId so locked-rate snapshots are applied (SLICE 2).
  const cuttingRates = await rateResolver.listRates(
    isDepthScaled ? "cutting-mm" : "cutting",
    input.tenderId ? { tenderId: input.tenderId } : undefined
  );

  // Filter to the resolved equipment/elevation combination.
  // cutting table (legacy adapter): keys are lowercase camelCase (equipment, elevation, material).
  // cutting-mm table (RateTable adapter): keys are column names from the schema ("Equipment", "Elevation").
  // Use requestedElevation for cutting-mm (Floor/Wall, not collapsed "Any").
  const candidates = isDepthScaled
    ? cuttingRates.filter(
        (r) =>
          // cutting-mm columns are "Equipment" and "Elevation" (title-cased).
          (r.keys["Equipment"] === equipment || r.keys["equipment"] === equipment) &&
          (r.keys["Elevation"] === requestedElevation || r.keys["elevation"] === requestedElevation)
      )
    : cuttingRates.filter(
        (r) =>
          r.keys["equipment"] === equipment &&
          r.keys["elevation"] === effectiveElevation &&
          r.keys["material"] === effectiveMaterial
      );

  let baseRateRow: { rowId: string; value: number } | null = null;

  if (isDepthScaled) {
    // cutting-mm: any row for this equipment/elevation (just need one for the
    // step formula to run against — the step does: start rate, multiply depthMm,
    // divide 25, floor 18, multiply metres). Use the first (Floor or Wall) row.
    const row = candidates[0];
    if (row) {
      baseRateRow = { rowId: row.rowId, value: row.value };
    }
  } else {
    // Deepest at-or-above-requested (original: depthMm >= depthMm, asc → first).
    const atOrAbove = candidates
      .filter((r) => Number(r.keys["depthMm"]) >= depthMm)
      .sort((a, b) => Number(a.keys["depthMm"]) - Number(b.keys["depthMm"]));
    if (atOrAbove.length > 0) {
      const row = atOrAbove[0];
      baseRateRow = { rowId: row.rowId, value: row.value };
    } else {
      // Requested depth exceeds max seeded depth — use the biggest available.
      const biggest = candidates.sort(
        (a, b) => Number(b.keys["depthMm"]) - Number(a.keys["depthMm"])
      )[0];
      if (biggest) baseRateRow = { rowId: biggest.rowId, value: biggest.value };
    }
  }

  if (!baseRateRow) return null;

  const baseRate = baseRateRow.value;

  // CHARGE_STEPS_PRICE_CUTTING_V1: run the step formula.
  // When chargeStepPricing is available, price through the table's charge steps.
  // When not available (unit-test compat), return baseRate directly.
  // elevationMultiplier is always 1.0 — elevation premium is in the priced Wall
  // rows, not a multiplier (see seeded Ringsaw Wall rows at today's x1.1 figures).
  const elevationMultiplier = 1.0;

  if (chargeStepPricing) {
    const priced = await chargeStepPricing.priceRow({
      tableSlug,
      row: { value: baseRate, rowId: baseRateRow.rowId },
      lineFields: { method: effectiveMethod ?? "", depthMm, metres: 1 },
      tenderId: input.tenderId
    });

    if (!priced) {
      // No steps on this table, or a step failed to resolve.
      // Treat as no-rate-row (same as when no matching row was found).
      return null;
    }

    // methodMultiplier: read from trail — the factor applied by the method
    // conditional step (e.g. multiply 1.25 when method is "High-Freq").
    // Fall back to 1.0 when the trail has no such step or it was skipped.
    const methodMultiplier = extractMethodMultiplierFromTrail(priced.trail, effectiveMethod);

    return {
      baseRate,
      methodMultiplier,
      elevationMultiplier,
      finalRate: priced.value
    };
  }

  // Unit-test compat path (no chargeStepPricing provided): return baseRate directly.
  return { baseRate, methodMultiplier: 1.0, elevationMultiplier, finalRate: baseRate };
}

/**
 * Extract the methodMultiplier from the step trail.
 * Looks for a multiply step whose condition matches the effective method.
 * Returns the step's field value if it was applied, 1.0 otherwise.
 */
function extractMethodMultiplierFromTrail(
  trail: Array<{ index: number; op: string; runningTotal: number | null; skipped: boolean }>,
  effectiveMethod: string | null
): number {
  // The method steps are: multiply 1.25 when method is "High-Freq"
  //                        multiply 1.25 when method is "Low-emission"
  // Both produce a 1.25 factor. We look for non-skipped multiply steps
  // after the start step to find the applied factor.
  if (!effectiveMethod) return 1.0;
  // Find the first non-skipped multiply step after step 0 (start).
  // The factor is the ratio of consecutive runnning totals.
  for (let i = 1; i < trail.length; i++) {
    const entry = trail[i];
    if (entry.skipped) continue;
    if (entry.op === "multiply") {
      const prev = trail[i - 1];
      if (prev && prev.runningTotal && prev.runningTotal !== 0) {
        const factor = (entry.runningTotal ?? 1) / prev.runningTotal;
        return factor;
      }
    }
  }
  return 1.0;
}

// Core hole resolver — spec Part 3.2. Returns isPOA=true for > 650mm so
// the UI can display the manual-pricing flag; undersize rounds up to 32mm;
// between-listed diameters round up to the next available diameter.
/** Result of resolveCoreHoleRate: either a POA flag or resolved rate + multipliers. */
export type CoreHoleRateResult =
  | { isPOA: true; ratePerHole: null; methodMultiplier: number; elevationMultiplier: number }
  | {
      isPOA: false;
      ratePerHole: number;
      diameterResolved: number;
      methodMultiplier: number;
      elevationMultiplier: number;
    };

/**
 * CHARGE_STEPS_PRICE_CUTTING_V1 — Core hole rate resolver using charge steps.
 *
 * Row selection (> 650mm POA, round up to 32mm, next-at-or-above diameter)
 * stays in this function. After selection, `chargeStepPricing.priceRow()` runs
 * the `core-hole` step formula:
 *   start depthMm -> divide 10 -> round nearest 1 -> floor 1
 *   -> multiply rate col -> multiply 1.1 when elevation is "Wall"
 *   -> multiply 2 when elevation is "Inverted" -> multiply holes
 *
 * Core holes take no method multiplier (D3 from CUTTING_RATE_CORRECTIONS_V1).
 *
 * When `chargeStepPricing` is not provided (unit-test compat), the raw matched
 * row value is returned as ratePerHole with elevationMultiplier computed from
 * the step grammar's values (Wall=1.1, Inverted=2.0) for backward compat.
 *
 * rates-consumers SLICE 2 — uses RateResolverService.listRates so canonical-source
 * routing is honoured and locked-rate snapshots are applied.
 *
 * @param rateResolver - RateResolverService for core-hole lookups
 * @param input - diameterMm plus optional elevation/method for multipliers
 * @param chargeStepPricing - optional: when provided, uses step formula
 * @returns a CoreHoleRateResult, or null when no active rate row matches
 */
export async function resolveCoreHoleRate(
  rateResolver: RateResolverService,
  input: { diameterMm: number; elevation?: string | null; method?: string | null; tenderId?: string | null },
  chargeStepPricing?: ChargeStepPricingService | null
): Promise<CoreHoleRateResult | null> {
  // CUTTING_RATE_CORRECTIONS_V1 — D3: core holes take no method multiplier.
  const methodMultiplier = 1.0;

  if (input.diameterMm > 650) {
    // > 650mm — manual pricing (POA). elevationMultiplier not applied to POA.
    return { isPOA: true, ratePerHole: null, methodMultiplier, elevationMultiplier: 1.0 };
  }
  // Minimum supported diameter is 32mm — anything smaller uses the 32mm rate.
  const lookupDiameter = Math.max(32, input.diameterMm);
  // rates-consumers SLICE 2 — fetch all core-hole rates and reproduce the
  // original findFirst(diameterMm >= lookupDiameter, asc) in-memory.
  // Pass tenderId so locked-rate snapshots are applied (SLICE 2).
  const allCoreHoleRates = await rateResolver.listRates("core-hole", input.tenderId ? { tenderId: input.tenderId } : undefined);
  const atOrAbove = allCoreHoleRates
    .filter((r) => Number(r.keys["diameterMm"]) >= lookupDiameter)
    .sort((a, b) => Number(a.keys["diameterMm"]) - Number(b.keys["diameterMm"]));
  if (atOrAbove.length === 0) return null;
  const matched = atOrAbove[0];

  if (chargeStepPricing) {
    // CHARGE_STEPS_PRICE_CUTTING_V1: price through core-hole steps.
    // The step formula encodes depth rounding, floor, elevation multiplier, and holes.
    // We pass holes=1 and metres=1 because the calling code multiplies out itself.
    // depthMm and elevation are line fields the steps use.
    const depthMm = input.diameterMm > 0 ? input.diameterMm : 0;
    const elevation = input.elevation ?? "Floor";
    const priced = await chargeStepPricing.priceRow({
      tableSlug: "core-hole",
      row: { value: matched.value, rowId: matched.rowId },
      lineFields: { depthMm, elevation, holes: 1 },
      tenderId: input.tenderId
    });

    if (!priced) {
      // No steps or step evaluation failed.
      return null;
    }

    // elevationMultiplier is always 1.0 in the returned shape — it is baked into
    // the step total. The caller's multiplication path uses ratePerHole directly.
    return {
      isPOA: false,
      ratePerHole: priced.value,
      diameterResolved: Number(matched.keys["diameterMm"]),
      methodMultiplier,
      elevationMultiplier: 1.0
    };
  }

  // Unit-test compat path (no chargeStepPricing provided).
  // Return the raw row value; caller applies its own elevation logic.
  const elevationMultiplierCompat =
    input.elevation === "Wall" ? 1.1 : input.elevation === "Inverted" ? 2.0 : 1.0;
  return {
    isPOA: false,
    ratePerHole: matched.value,
    diameterResolved: Number(matched.keys["diameterMm"]),
    methodMultiplier,
    elevationMultiplier: elevationMultiplierCompat
  };
}

/**
 * Service behind the Scope of Works redesign: column availability, the
 * per-(tender × discipline) view config, the cutting-items sheet with
 * server-side Cutrite rate resolution, and the tender pricing summary.
 *
 * All pricing (ratePerM / ratePerHole / lineTotal) is derived
 * server-side on create/update — clients never submit calculated
 * values.
 */
@Injectable()
export class ScopeRedesignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService,
    @Optional() private readonly chargeStepPricing?: ChargeStepPricingService
  ) {}

  // ── Columns ──────────────────────────────────────────────────────────
  /**
   * Returns the available + required columns for a row type.
   *
   * @param rowType - row type to look up
   * @returns `{ available, required }` column-name arrays
   * @throws BadRequestException when the rowType is unknown
   */
  getColumnsForRowType(rowType: string) {
    return columnsForRowType(rowType);
  }

  // ── View config ──────────────────────────────────────────────────────
  /**
   * Returns the stored optional-column set for (tender × discipline),
   * falling back to the union of the discipline's row-type columns
   * (minus required columns) when no config row exists.
   *
   * @returns `{ tenderId, discipline, columns }`
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when the discipline is unknown
   */
  async getViewConfig(tenderId: string, discipline: string) {
    await this.requireTender(tenderId);
    this.assertDiscipline(discipline);
    const existing = await this.prisma.scopeViewConfig.findUnique({
      where: { tenderId_discipline: { tenderId, discipline } }
    });
    if (existing) {
      return {
        tenderId,
        discipline,
        columns: Array.isArray(existing.columns) ? (existing.columns as string[]) : defaultColumnsForDiscipline(discipline as Discipline)
      };
    }
    return {
      tenderId,
      discipline,
      columns: defaultColumnsForDiscipline(discipline as Discipline)
    };
  }

  /**
   * Upserts the optional-column set for (tender × discipline),
   * filtering out non-string / empty entries before persisting.
   *
   * @param columns - column names to store; cleaned of empty/non-string values
   * @returns the upserted ScopeViewConfig row
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when the discipline is unknown
   */
  async upsertViewConfig(tenderId: string, discipline: string, columns: string[]) {
    await this.requireTender(tenderId);
    this.assertDiscipline(discipline);
    const cleaned = columns.filter((c) => typeof c === "string" && c.length > 0);
    return this.prisma.scopeViewConfig.upsert({
      where: { tenderId_discipline: { tenderId, discipline } },
      create: { tenderId, discipline, columns: cleaned as unknown as Prisma.InputJsonValue },
      update: { columns: cleaned as unknown as Prisma.InputJsonValue }
    });
  }

  // ── Cutting sheet items ──────────────────────────────────────────────

  /**
   * SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — augment a cutting row
   * with effectiveMarkup and lineTotalWithMarkup. cardCuttingOverride is the
   * card's cuttingMarkupOverride (null = not set); tenderMarkup is the tender's
   * TenderEstimate.markup (default 30 when absent).
   */
  private augmentCuttingMoney<T extends {
    lineTotal: Prisma.Decimal | null;
    markupOverride: Prisma.Decimal | null;
  }>(row: T, cardCuttingOverride: number | null, tenderMarkup: number): T & {
    effectiveMarkup: number;
    lineTotalWithMarkup: number;
  } {
    const lineMarkupOverride = row.markupOverride != null ? Number(row.markupOverride) : null;
    const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardCuttingOverride, tenderMarkup);
    const lt = row.lineTotal != null ? Number(row.lineTotal) : 0;
    const lineTotalWithMarkup = lt * (1 + effectiveMarkup / 100);
    return {
      ...row,
      effectiveMarkup: Number(effectiveMarkup.toFixed(2)),
      lineTotalWithMarkup: Number(lineTotalWithMarkup.toFixed(2))
    };
  }

  /**
   * Lists cutting sheet items for a tender, ordered by wbsRef then
   * sortOrder, with the `otherRate` relation included.
   *
   * SCOPE_LINE_MARKUP_ALL_TYPES_V1: each row now also carries
   * `effectiveMarkup` and `lineTotalWithMarkup` computed server-side.
   *
   * @param options - optional `cardId` to scope to one card; omitted → whole-tender list
   * @returns cutting items for the tender (optionally one card), with money fields
   * @throws NotFoundException when the tender does not exist
   */
  async listCuttingItems(tenderId: string, options?: { cardId?: string }) {
    await this.requireTender(tenderId);
    // PR B4b — when cardId is supplied, scope the list to a single
    // card (per-card subtable). Omitted → whole-tender list (legacy
    // callers + admin views).
    const rows = await this.prisma.cuttingSheetItem.findMany({
      where: {
        tenderId,
        ...(options?.cardId ? { cardId: options.cardId } : {})
      },
      orderBy: [{ wbsRef: "asc" }, { sortOrder: "asc" }],
      include: { otherRate: true, card: { select: { cuttingMarkupOverride: true } } }
    });
    const tenderEst = await this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } });
    const tenderMarkup = tenderEst ? Number(tenderEst.markup) : 30;
    return rows.map((row) => {
      const cardCuttingOverride = row.card?.cuttingMarkupOverride != null ? Number(row.card.cuttingMarkupOverride) : null;
      return this.augmentCuttingMoney(row, cardCuttingOverride, tenderMarkup);
    });
  }

  /**
   * Creates a cutting sheet item with server-derived pricing
   * (ratePerM / ratePerHole / lineTotal via the Cutrite resolvers).
   * Rows always default autoCopied=false — only copyFromAbove sets it.
   *
   * @param actorId - recorded as createdById
   * @param dto - raw inputs; cardId is required and must belong to the tender
   * @returns the created item with its `otherRate` relation
   * @throws BadRequestException when wbsRef/cardId is missing or itemType is invalid
   * @throws NotFoundException when the tender or scope card is not found
   */
  async createCuttingItem(
    tenderId: string,
    actorId: string,
    dto: {
      wbsRef: string;
      description?: string | null;
      itemType: "saw-cut" | "core-hole" | "other-rate";
      equipment?: string | null;
      elevation?: string | null;
      material?: string | null;
      depthMm?: number | null;
      diameterMm?: number | null;
      quantityLm?: number | null;
      quantityEach?: number | null;
      shift?: string | null;
      method?: string | null;
      shiftLoading?: number | null;
      otherRateId?: string | null;
      notes?: string | null;
      sortOrder?: number | null;
      cardId?: string | null;
      // SCOPE_QUOTE_DESTINATION_V1 -- where this cutting line goes on the quote.
      quoteDestination?: QuoteDestination | null;
      // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- per-line markup override.
      markupOverride?: number | null;
    }
  ) {
    await this.requireTender(tenderId);
    if (!dto.wbsRef?.trim()) throw new BadRequestException("wbsRef is required.");
    if (!["saw-cut", "core-hole", "other-rate"].includes(dto.itemType)) {
      throw new BadRequestException('itemType must be "saw-cut", "core-hole", or "other-rate".');
    }
    // PR B-followup — cardId is now NOT NULL at the schema level.
    // Missing or blank values get a controlled 400 here; B4b.1's
    // empty-string-to-null normalization is no longer a valid path
    // (Prisma would reject the insert). Same end-user property
    // (controlled 400, not 500-via-FK) but the rejection lives one
    // level higher.
    if (
      dto.cardId == null ||
      (typeof dto.cardId === "string" && dto.cardId.trim() === "")
    ) {
      throw new BadRequestException(
        "cardId is required — cutting items must belong to a scope card."
      );
    }
    const cardId = dto.cardId.trim();
    // PR B4b — validate the card belongs to this tender so a stale
    // frontend can't attach rows to a foreign card.
    {
      const card = await this.prisma.scopeCard.findFirst({
        where: { id: cardId, tenderId },
        select: { id: true }
      });
      if (!card) throw new NotFoundException("Scope card not found on this tender.");
    }
    const priced = await this.pricedCuttingData({ ...dto, tenderId });
    const [created, tenderEst] = await Promise.all([
      this.prisma.cuttingSheetItem.create({
        data: {
          tenderId,
          cardId,
          createdById: actorId,
          wbsRef: dto.wbsRef.trim(),
          description: dto.description?.trim() || null,
          itemType: dto.itemType,
          equipment: dto.equipment ?? null,
          elevation: dto.elevation ?? null,
          material: dto.material ?? null,
          depthMm: dto.depthMm ?? null,
          diameterMm: dto.diameterMm ?? null,
          quantityLm: dto.quantityLm !== undefined && dto.quantityLm !== null ? new Prisma.Decimal(dto.quantityLm) : null,
          quantityEach: dto.quantityEach ?? null,
          shift: dto.shift ?? null,
          method: dto.method ?? null,
          shiftLoading: dto.shiftLoading !== undefined && dto.shiftLoading !== null ? new Prisma.Decimal(dto.shiftLoading) : null,
          otherRateId: dto.otherRateId ?? null,
          notes: dto.notes ?? null,
          sortOrder: dto.sortOrder ?? 0,
          // PR B4b — manual creates default autoCopied=false. The Copy
          // from above aggregator is the only path that flips this true.
          autoCopied: false,
          ratePerM: priced.ratePerM,
          ratePerHole: priced.ratePerHole,
          lineTotal: priced.lineTotal,
          // SCOPE_QUOTE_DESTINATION_V1 -- defaults PRICE when absent.
          quoteDestination: dto.quoteDestination ?? QuoteDestination.PRICE,
          // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- null stored when absent.
          markupOverride: dto.markupOverride !== undefined && dto.markupOverride !== null
            ? new Prisma.Decimal(dto.markupOverride)
            : null
        },
        include: { otherRate: true, card: { select: { cuttingMarkupOverride: true } } }
      }),
      this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
    ]);
    const tenderMarkup = tenderEst ? Number(tenderEst.markup) : 30;
    const cardCuttingOverride = created.card?.cuttingMarkupOverride != null ? Number(created.card.cuttingMarkupOverride) : null;
    return this.augmentCuttingMoney(created, cardCuttingOverride, tenderMarkup);
  }

  /**
   * Partially updates a cutting item, merging the patch over the
   * existing row and re-running the full pricing derivation so
   * ratePerM / ratePerHole / lineTotal stay consistent.
   *
   * @param dto - partial patch; undefined fields keep their existing values
   * @returns the updated item with its `otherRate` relation
   * @throws NotFoundException when the item is missing or belongs to another tender
   * @throws BadRequestException when the patched itemType is invalid
   */
  async updateCuttingItem(
    tenderId: string,
    itemId: string,
    dto: Partial<{
      wbsRef: string;
      description: string | null;
      itemType: "saw-cut" | "core-hole" | "other-rate";
      equipment: string | null;
      elevation: string | null;
      material: string | null;
      depthMm: number | null;
      diameterMm: number | null;
      quantityLm: number | null;
      quantityEach: number | null;
      shift: string | null;
      method: string | null;
      shiftLoading: number | null;
      otherRateId: string | null;
      notes: string | null;
      sortOrder: number | null;
      // SCOPE_QUOTE_DESTINATION_V1 -- where this cutting line goes on the quote.
      quoteDestination: QuoteDestination | null;
      // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- per-line markup override.
      markupOverride: number | null;
    }>
  ) {
    const existing = await this.prisma.cuttingSheetItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Cutting item not found.");
    if (dto.itemType !== undefined && !["saw-cut", "core-hole", "other-rate"].includes(dto.itemType)) {
      throw new BadRequestException('itemType must be "saw-cut", "core-hole", or "other-rate".');
    }

    const merged = {
      itemType: (dto.itemType ?? existing.itemType) as "saw-cut" | "core-hole" | "other-rate",
      equipment: dto.equipment !== undefined ? dto.equipment : existing.equipment,
      elevation: dto.elevation !== undefined ? dto.elevation : existing.elevation,
      material: dto.material !== undefined ? dto.material : existing.material,
      depthMm: dto.depthMm !== undefined ? dto.depthMm : existing.depthMm,
      diameterMm: dto.diameterMm !== undefined ? dto.diameterMm : existing.diameterMm,
      quantityLm:
        dto.quantityLm !== undefined
          ? dto.quantityLm
          : existing.quantityLm
            ? Number(existing.quantityLm)
            : null,
      quantityEach: dto.quantityEach !== undefined ? dto.quantityEach : existing.quantityEach,
      shift: dto.shift !== undefined ? dto.shift : existing.shift,
      method: dto.method !== undefined ? dto.method : existing.method,
      shiftLoading:
        dto.shiftLoading !== undefined
          ? dto.shiftLoading
          : existing.shiftLoading
            ? Number(existing.shiftLoading)
            : null,
      otherRateId: dto.otherRateId !== undefined ? dto.otherRateId : existing.otherRateId
    };
    const priced = await this.pricedCuttingData({ ...merged, tenderId });
    const updated = await this.prisma.cuttingSheetItem.update({
      where: { id: itemId },
      data: {
        wbsRef: dto.wbsRef !== undefined ? dto.wbsRef.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        itemType: dto.itemType,
        equipment: dto.equipment,
        elevation: dto.elevation,
        material: dto.material,
        depthMm: dto.depthMm,
        diameterMm: dto.diameterMm,
        quantityLm:
          dto.quantityLm === undefined
            ? undefined
            : dto.quantityLm === null
              ? null
              : new Prisma.Decimal(dto.quantityLm),
        quantityEach: dto.quantityEach,
        shift: dto.shift,
        method: dto.method,
        shiftLoading:
          dto.shiftLoading === undefined
            ? undefined
            : dto.shiftLoading === null
              ? null
              : new Prisma.Decimal(dto.shiftLoading),
        otherRateId: dto.otherRateId,
        notes: dto.notes,
        sortOrder: dto.sortOrder ?? undefined,
        ratePerM: priced.ratePerM,
        ratePerHole: priced.ratePerHole,
        lineTotal: priced.lineTotal,
        // SCOPE_QUOTE_DESTINATION_V1 -- only overwrite when the DTO carries a non-null value.
        ...(dto.quoteDestination != null ? { quoteDestination: dto.quoteDestination } : {}),
        // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- only overwrite when the DTO carries it.
        ...(dto.markupOverride !== undefined
          ? {
              markupOverride: dto.markupOverride !== null
                ? new Prisma.Decimal(dto.markupOverride)
                : null
            }
          : {})
      },
      include: { otherRate: true, card: { select: { cuttingMarkupOverride: true } } }
    });
    const tenderEst = await this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } });
    const tenderMarkup = tenderEst ? Number(tenderEst.markup) : 30;
    const cardCuttingOverride = updated.card?.cuttingMarkupOverride != null ? Number(updated.card.cuttingMarkupOverride) : null;
    return this.augmentCuttingMoney(updated, cardCuttingOverride, tenderMarkup);
  }

  /**
   * Hard-deletes a cutting item after verifying it belongs to the tender.
   *
   * @returns `{ id }` of the deleted item
   * @throws NotFoundException when the item is missing or belongs to another tender
   */
  async deleteCuttingItem(tenderId: string, itemId: string) {
    const existing = await this.prisma.cuttingSheetItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Cutting item not found.");
    await this.prisma.cuttingSheetItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  /**
   * PR B4b — "Copy from above" aggregator for the per-card cutting
   * subtable's Saw-cut tab. Reads scope items on the card where
   * cuttingIncluded=true, then atomically replaces the card's
   * autoCopied=true saw-cut rows with one fresh row per qualifying
   * scope item. Manual saw-cut rows (autoCopied=false), all core-hole
   * rows, and all other-rate rows are untouched.
   *
   * Per-item mapping:
   *   - wbsRef     = scopeItem.wbsCode  (cutting uses `wbsRef`, scope uses `wbsCode`)
   *   - description = scopeItem.description (verbatim)
   *   - depthMm     = round(scopeItem.depth × 1000)  (m → mm; Marco's locked answer #4)
   *   - quantityLm  = scopeItem.length  (already metres → Lm)
   *   - material    = inferCuttingMaterial(scopeItem) (may be null)
   *   - equipment / elevation / method / shift = null  (estimator picks)
   *   - autoCopied  = true
   *
   * Items missing length OR depth are skipped silently.
   *
   * Warnings: depthMm > 2000 produces a warning entry in the response
   * (does NOT block the row) so the estimator can sanity-check before
   * the row reaches the cutting matrix.
   *
   * Mirrors ScopeWasteService.sumFromAbove from B3.
   */
  async copyFromAbove(
    tenderId: string,
    cardId: string,
    actorId: string
  ): Promise<{ replaced: number; created: number; warnings: string[] }> {
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true }
    });
    if (!card) throw new NotFoundException("Scope card not found on this tender.");

    // PR feat/scope-material-inline-waste — cuttingIncluded is now per
    // material (Material 1 = item.cuttingIncluded; Material 2..N =
    // entry.cuttingIncluded). Fetch every non-excluded item on the card
    // and filter in-memory so items that opted in ONLY via a Material
    // 2+ entry aren't missed by a where clause that scoped to item-level
    // cuttingIncluded=true. Card sizes are small (< a few hundred rows)
    // so pulling the full set is cheap.
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, cardId, status: { not: "excluded" } },
      select: {
        wbsCode: true,
        description: true,
        length: true,
        depth: true,
        material: true,
        materialType: true,
        cuttingIncluded: true,
        materials: true
      }
    });

    type RowPayload = {
      wbsRef: string;
      description: string | null;
      depthMm: number;
      quantityLm: Prisma.Decimal;
      material: string | null;
    };
    const payloads: RowPayload[] = [];
    const warnings: string[] = [];

    // Emit one payload per cutting-flagged material. Material 1 reuses
    // the item's flat length/depth/material inference; Material 2..N
    // each contribute a distinct saw-cut row derived from the entry's
    // own length/depth/material.
    const pushPayload = (
      wbsRef: string,
      description: string | null,
      length: number,
      depth: number,
      materialLabel: string | null
    ) => {
      if (!(length > 0) || !(depth > 0)) return;
      const depthMm = Math.round(depth * 1000);
      if (depthMm > 2000) {
        warnings.push(`${wbsRef}: depth ${depthMm}mm — please verify`);
      }
      payloads.push({
        wbsRef,
        description,
        depthMm,
        quantityLm: new Prisma.Decimal(length),
        material: materialLabel
      });
    };

    for (const item of items) {
      if (item.cuttingIncluded === true) {
        const length = item.length == null ? 0 : Number(item.length);
        const depth = item.depth == null ? 0 : Number(item.depth);
        pushPayload(
          item.wbsCode,
          item.description ?? null,
          length,
          depth,
          inferCuttingMaterial(item)
        );
      }
      const materials = Array.isArray(item.materials)
        ? (item.materials as Array<{
            length?: unknown;
            depth?: unknown;
            material?: unknown;
            cuttingIncluded?: unknown;
          }>)
        : [];
      for (const m of materials) {
        if (m?.cuttingIncluded !== true) continue;
        const length = Number(m?.length);
        const depth = Number(m?.depth);
        if (!Number.isFinite(length) || !Number.isFinite(depth)) continue;
        const materialLabel = inferCuttingMaterial({
          material: typeof m?.material === "string" ? m.material : null,
          materialType: null,
          description: item.description ?? null
        });
        pushPayload(
          item.wbsCode,
          item.description ?? null,
          length,
          depth,
          materialLabel
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.cuttingSheetItem.deleteMany({
        where: { tenderId, cardId, itemType: "saw-cut", autoCopied: true }
      });
      let created = 0;
      for (let i = 0; i < payloads.length; i += 1) {
        const p = payloads[i];
        await tx.cuttingSheetItem.create({
          data: {
            tenderId,
            cardId,
            createdById: actorId,
            wbsRef: p.wbsRef,
            description: p.description,
            itemType: "saw-cut",
            equipment: null,
            elevation: null,
            material: p.material,
            depthMm: p.depthMm,
            diameterMm: null,
            quantityLm: p.quantityLm,
            quantityEach: null,
            shift: null,
            method: null,
            shiftLoading: null,
            otherRateId: null,
            notes: null,
            sortOrder: i,
            autoCopied: true,
            // Equipment / elevation / method are all null on copy →
            // pricedCuttingData short-circuits to null; row appears
            // unpriced until the estimator picks. No need to call it.
            ratePerM: null,
            ratePerHole: null,
            lineTotal: null
          }
        });
        created += 1;
      }
      return { replaced: deleted.count, created };
    });

    return { ...result, warnings };
  }

  // ── Summary ──────────────────────────────────────────────────────────
  /**
   * Computes the tender pricing rollup: per-discipline scope-item
   * subtotals (markup resolved through resolveEffectiveMarkup:
   * item.markupOverride ?? card.markupOverride ?? tender markup), the
   * cutting subtotal, waste totals by discipline, and the combined
   * tenderPrice. Excluded scope items are skipped.
   *
   * @returns per-discipline buckets plus `cutting`, `waste`, and `tenderPrice`
   * @throws NotFoundException when the tender does not exist
   */
  async summary(tenderId: string) {
    await this.requireTender(tenderId);
    // PR B1.7.2 — per-discipline subtotals now go through the same
    // computeScopeItemTotal helper that listItems() uses, so the table
    // footer's "Subtotal" / "With markup" exactly matches the sum of
    // visible row totals. The legacy priceByItemId path silently
    // returned $0 for canonical (B1.6+) rows because they don't link
    // to an EstimateItem.
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: { not: "excluded" } },
      include: {
        card: true,
        // scope-subcontracted order 4 — needed for double-count guard and SUB
        // line quote pricing.
        subLineQuotes: { where: { isSelected: true }, select: { amount: true } }
      }
    });
    // rates-consumers SLICE 2 — route through RateResolverService.
    // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate
    // snapshots are applied when this tender has a TenderRateSet.
    // See listItems() note in scope-of-works.service.ts for isActive caveat.
    const snapshotOpts = { tenderId };
    const [labourListed, plantListed, tenderEstimate] = await Promise.all([
      this.rateResolver.listRates("labour", snapshotOpts),
      this.rateResolver.listRates("plant", snapshotOpts),
      this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
    ]);
    // Labour: pass ALL (role, shift) rows so buildRateMaps resolves
    // night/weekend rates via labourRateForShift (WBS-SHIFT-S2).
    const labourRates = labourListed.map((r) => ({
      role: String(r.keys["role"] ?? ""),
      shift: String(r.keys["shift"] ?? "day"),
      rate: new Prisma.Decimal(r.value)
    }));
    const plantRates = plantListed.map((r) => ({
      id: r.rowId,
      rate: new Prisma.Decimal(r.value)
    }));
    const rateMaps = buildRateMaps(labourRates, plantRates);
    const tenderMarkup = tenderEstimate ? Number(tenderEstimate.markup) : 30;

    // SCOPE_QUOTE_DESTINATION_V1 -- each bucket carries four pairs instead of two:
    //   subtotal / withMarkup           -> PRICE destination
    //   provisionalSubtotal / ...WithMarkup -> PROVISIONAL destination
    //   optionSubtotal / ...WithMarkup      -> OPTION destination
    //   internalSubtotal / ...WithMarkup    -> INTERNAL destination (reported, not summed into price)
    //
    // Covered-item zeroing (the pricedBySubItemId rule) and the provisional
    // predicate (its boolean flag OR the discipline test) are removed. The quoteDestination
    // column already encodes both decisions for every row via the backfill.
    // Rule B (SUB line prices at selected quote) is unchanged.
    const perDiscipline: Record<
      string,
      {
        itemCount: number;
        subtotal: number;
        withMarkup: number;
        provisionalSubtotal: number;
        provisionalWithMarkup: number;
        optionSubtotal: number;
        optionWithMarkup: number;
        internalSubtotal: number;
        internalWithMarkup: number;
      }
    > = {};
    for (const d of DISCIPLINES)
      perDiscipline[d] = {
        itemCount: 0,
        subtotal: 0,
        withMarkup: 0,
        provisionalSubtotal: 0,
        provisionalWithMarkup: 0,
        optionSubtotal: 0,
        optionWithMarkup: 0,
        internalSubtotal: 0,
        internalWithMarkup: 0
      };
    for (const item of items) {
      const itemDiscipline = (item.card?.discipline ?? "") as Discipline;
      const bucket = perDiscipline[itemDiscipline];
      if (!bucket) continue;
      bucket.itemCount += 1;
      const effectiveMarkup = resolveEffectiveMarkup(
        item.markupOverride != null ? Number(item.markupOverride) : null,
        item.card?.markupOverride != null ? Number(item.card.markupOverride) : null,
        tenderMarkup
      );

      let totals: { lineTotal: number; lineTotalWithMarkup: number };

      // Rule B (scope-subcontracted order 4) -- a SUB discipline line's own
      // price is the selected quote (amount where isSelected). When no quote
      // is selected the line prices at zero (visibly incomplete, not silently
      // free). Covered-item zeroing was removed; INTERNAL destination
      // rows do the same work and are encoded by the backfill migration.
      if (itemDiscipline === "SUB") {
        const selectedQuote = item.subLineQuotes[0];
        const quoteAmount = selectedQuote ? Number(selectedQuote.amount) : 0;
        const markupFactor = 1 + (Number.isFinite(effectiveMarkup) ? effectiveMarkup : 0) / 100;
        totals = { lineTotal: quoteAmount, lineTotalWithMarkup: quoteAmount * markupFactor };
      } else {
        const computed = computeScopeItemTotal(
          toPricingInput(item, itemDiscipline),
          rateMaps,
          effectiveMarkup
        );
        totals = { lineTotal: computed.lineTotal, lineTotalWithMarkup: computed.lineTotalWithMarkup };
      }

      // Route by quoteDestination. INTERNAL is reported but not summed into
      // tenderPrice, provisionalTotal, or optionsTotal.
      const dest = (item.quoteDestination as QuoteDestination | undefined) ?? QuoteDestination.PRICE;
      if (dest === QuoteDestination.PROVISIONAL) {
        bucket.provisionalSubtotal += totals.lineTotal;
        bucket.provisionalWithMarkup += totals.lineTotalWithMarkup;
      } else if (dest === QuoteDestination.OPTION) {
        bucket.optionSubtotal += totals.lineTotal;
        bucket.optionWithMarkup += totals.lineTotalWithMarkup;
      } else if (dest === QuoteDestination.INTERNAL) {
        bucket.internalSubtotal += totals.lineTotal;
        bucket.internalWithMarkup += totals.lineTotalWithMarkup;
      } else {
        // PRICE (default)
        bucket.subtotal += totals.lineTotal;
        bucket.withMarkup += totals.lineTotalWithMarkup;
      }
    }

    // Per-section markup -- cutting, waste, and operational costs are independent
    // cost streams. Each aggregates per card and applies
    // (card.<section>MarkupOverride ?? tenderMarkup). NEVER folded into the
    // scope discipline total.
    //
    // SCOPE_QUOTE_DESTINATION_V1 -- each stream now also splits by
    // quoteDestination so the four global totals can be derived:
    //   PRICE side:       subtotal / withMarkup  (existing readers unchanged)
    //   PROVISIONAL side: provisional.subtotal / provisional.withMarkup
    //   OPTION side:      option.subtotal / option.withMarkup
    //   INTERNAL side:    internal.subtotal / internal.withMarkup (reported only)
    // The top-level pair always means "PRICE" so existing callers of
    // cutting.withMarkup / waste.withMarkup / operationalCosts.withMarkup
    // keep their meaning.
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- select markupOverride
    // per line so each line resolves its own effective markup via
    // resolveEffectiveMarkup(line.markupOverride, card.cuttingMarkupOverride, tenderMarkup).
    // The per-card "subtotal then multiply" step is replaced: each line's
    // lineTotalWithMarkup = lineTotal * (1 + effectiveMarkup / 100).
    // Equivalence: with no line overrides, results are byte-identical to the
    // per-card bucket approach because the factor is constant per card.
    const cuttingItems = await this.prisma.cuttingSheetItem.findMany({
      where: { tenderId },
      select: {
        cardId: true,
        lineTotal: true,
        markupOverride: true,
        quoteDestination: true,
        card: { select: { cuttingMarkupOverride: true } }
      }
    });
    let cuttingSubtotal = 0;
    let cuttingWithMarkup = 0;
    let cuttingProvisionalSubtotal = 0;
    let cuttingProvisionalWithMarkup = 0;
    let cuttingOptionSubtotal = 0;
    let cuttingOptionWithMarkup = 0;
    let cuttingInternalSubtotal = 0;
    let cuttingInternalWithMarkup = 0;
    for (const ci of cuttingItems) {
      const amt = ci.lineTotal ? Number(ci.lineTotal) : 0;
      const cardCuttingOverride = ci.card?.cuttingMarkupOverride != null ? Number(ci.card.cuttingMarkupOverride) : null;
      const lineMarkupOverride = ci.markupOverride != null ? Number(ci.markupOverride) : null;
      const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardCuttingOverride, tenderMarkup);
      const lineTotalWithMarkup = amt * (1 + effectiveMarkup / 100);
      const dest = (ci.quoteDestination as QuoteDestination | null) ?? QuoteDestination.PRICE;
      if (dest === QuoteDestination.PROVISIONAL) {
        cuttingProvisionalSubtotal += amt;
        cuttingProvisionalWithMarkup += lineTotalWithMarkup;
      } else if (dest === QuoteDestination.OPTION) {
        cuttingOptionSubtotal += amt;
        cuttingOptionWithMarkup += lineTotalWithMarkup;
      } else if (dest === QuoteDestination.INTERNAL) {
        cuttingInternalSubtotal += amt;
        cuttingInternalWithMarkup += lineTotalWithMarkup;
      } else {
        cuttingSubtotal += amt;
        cuttingWithMarkup += lineTotalWithMarkup;
      }
    }

    // Waste totals -- PR #71. Each ScopeWasteItem has a server-side lineTotal.
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- select markupOverride per
    // line; resolve via resolveEffectiveMarkup(line.markupOverride,
    // card.wasteMarkupOverride, tenderMarkup) so each line contributes its own
    // lineTotalWithMarkup. The per-card bucket accumulation is replaced with
    // direct per-line accumulation. Equivalence: no line overrides -> results
    // byte-identical to the previous per-card approach.
    const wasteItems = await this.prisma.scopeWasteItem.findMany({
      where: { tenderId },
      select: {
        cardId: true,
        discipline: true,
        lineTotal: true,
        markupOverride: true,
        quoteDestination: true,
        card: { select: { wasteMarkupOverride: true } }
      }
    });
    const wasteByDiscipline: Record<string, number> = {};
    for (const d of DISCIPLINES) wasteByDiscipline[d] = 0;
    let wasteWithMarkup = 0;
    let wasteProvisionalSubtotal = 0;
    let wasteProvisionalWithMarkup = 0;
    let wasteOptionSubtotal = 0;
    let wasteOptionWithMarkup = 0;
    let wasteInternalSubtotal = 0;
    let wasteInternalWithMarkup = 0;
    for (const w of wasteItems) {
      const amt = w.lineTotal ? Number(w.lineTotal) : 0;
      const dest = (w.quoteDestination as QuoteDestination | null) ?? QuoteDestination.PRICE;
      // byDiscipline is PRICE-side only (same as before; the report never broke waste into destinations)
      if (dest === QuoteDestination.PRICE && Object.prototype.hasOwnProperty.call(wasteByDiscipline, w.discipline)) {
        wasteByDiscipline[w.discipline] += amt;
      }
      const cardWasteOverride = w.card?.wasteMarkupOverride != null ? Number(w.card.wasteMarkupOverride) : null;
      const lineMarkupOverride = w.markupOverride != null ? Number(w.markupOverride) : null;
      const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardWasteOverride, tenderMarkup);
      const lineTotalWithMarkup = amt * (1 + effectiveMarkup / 100);
      if (dest === QuoteDestination.PROVISIONAL) {
        wasteProvisionalSubtotal += amt;
        wasteProvisionalWithMarkup += lineTotalWithMarkup;
      } else if (dest === QuoteDestination.OPTION) {
        wasteOptionSubtotal += amt;
        wasteOptionWithMarkup += lineTotalWithMarkup;
      } else if (dest === QuoteDestination.INTERNAL) {
        wasteInternalSubtotal += amt;
        wasteInternalWithMarkup += lineTotalWithMarkup;
      } else {
        // PRICE
        wasteWithMarkup += lineTotalWithMarkup;
      }
    }
    const wasteTotal = Object.values(wasteByDiscipline).reduce((s, v) => s + v, 0);

    // SCOPE_OPERATIONAL_COSTS_PRICED_V1 -- the fourth independently-marked-up
    // stream. Each line's markup resolves through the same chain as scope items.
    const operationalLines = await this.prisma.scopeOperationalCostLine.findMany({
      where: { card: { tenderId } },
      select: {
        qty: true,
        unit: true,
        days: true,
        rate: true,
        rateOverride: true,
        markupOverride: true,
        quoteDestination: true,
        cardId: true,
        card: { select: { markupOverride: true } }
      }
    });
    let operationalSubtotal = 0;
    let operationalWithMarkup = 0;
    let operationalProvisionalSubtotal = 0;
    let operationalProvisionalWithMarkup = 0;
    let operationalOptionSubtotal = 0;
    let operationalOptionWithMarkup = 0;
    let operationalInternalSubtotal = 0;
    let operationalInternalWithMarkup = 0;
    const operationalByCard = new Map<string, { subtotal: number; withMarkup: number }>();
    for (const ol of operationalLines) {
      const lineTotal = computeOperationalLineTotal(ol);
      const effectiveMarkup = computeOperationalLineMarkup(
        decToNum(ol.markupOverride),
        ol.card?.markupOverride != null ? Number(ol.card.markupOverride) : null,
        tenderMarkup
      );
      const lineWithMarkup = lineTotal * (1 + effectiveMarkup / 100);
      const dest = (ol.quoteDestination as QuoteDestination | null) ?? QuoteDestination.PRICE;
      if (dest === QuoteDestination.PROVISIONAL) {
        operationalProvisionalSubtotal += lineTotal;
        operationalProvisionalWithMarkup += lineWithMarkup;
      } else if (dest === QuoteDestination.OPTION) {
        operationalOptionSubtotal += lineTotal;
        operationalOptionWithMarkup += lineWithMarkup;
      } else if (dest === QuoteDestination.INTERNAL) {
        operationalInternalSubtotal += lineTotal;
        operationalInternalWithMarkup += lineWithMarkup;
      } else {
        operationalSubtotal += lineTotal;
        operationalWithMarkup += lineWithMarkup;
        const bucket = operationalByCard.get(ol.cardId) ?? { subtotal: 0, withMarkup: 0 };
        bucket.subtotal += lineTotal;
        bucket.withMarkup += lineWithMarkup;
        operationalByCard.set(ol.cardId, bucket);
      }
    }

    // SCOPE_QUOTE_DESTINATION_V1 -- four grand totals, all 2 dp:
    //   tenderPrice     = all four streams' PRICE withMarkup (shape unchanged from S1)
    //   provisionalTotal = all four streams' PROVISIONAL withMarkup
    //   optionsTotal    = all four streams' OPTION withMarkup
    //   internalTotal   = all four streams' INTERNAL withMarkup (reported, not in price)
    // Never fold a bare subtotal into any of them.
    const scopeWithMarkupTotal = Object.values(perDiscipline).reduce((s, v) => s + v.withMarkup, 0);
    const scopeProvisionalTotal = Object.values(perDiscipline).reduce((s, v) => s + v.provisionalWithMarkup, 0);
    const scopeOptionTotal = Object.values(perDiscipline).reduce((s, v) => s + v.optionWithMarkup, 0);
    const scopeInternalTotal = Object.values(perDiscipline).reduce((s, v) => s + v.internalWithMarkup, 0);

    const tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup + operationalWithMarkup;
    const provisionalTotal = scopeProvisionalTotal + cuttingProvisionalWithMarkup + wasteProvisionalWithMarkup + operationalProvisionalWithMarkup;
    const optionsTotal = scopeOptionTotal + cuttingOptionWithMarkup + wasteOptionWithMarkup + operationalOptionWithMarkup;
    const internalTotal = scopeInternalTotal + cuttingInternalWithMarkup + wasteInternalWithMarkup + operationalInternalWithMarkup;

    return {
      ...perDiscipline,
      cutting: {
        itemCount: cuttingItems.length,
        subtotal: Number(cuttingSubtotal.toFixed(2)),
        withMarkup: Number(cuttingWithMarkup.toFixed(2)),
        provisional: {
          subtotal: Number(cuttingProvisionalSubtotal.toFixed(2)),
          withMarkup: Number(cuttingProvisionalWithMarkup.toFixed(2))
        },
        option: {
          subtotal: Number(cuttingOptionSubtotal.toFixed(2)),
          withMarkup: Number(cuttingOptionWithMarkup.toFixed(2))
        },
        internal: {
          subtotal: Number(cuttingInternalSubtotal.toFixed(2)),
          withMarkup: Number(cuttingInternalWithMarkup.toFixed(2))
        }
      },
      waste: {
        itemCount: wasteItems.length,
        byDiscipline: Object.fromEntries(
          Object.entries(wasteByDiscipline).map(([k, v]) => [k, Number(v.toFixed(2))])
        ),
        subtotal: Number(wasteTotal.toFixed(2)),
        withMarkup: Number(wasteWithMarkup.toFixed(2)),
        provisional: {
          subtotal: Number(wasteProvisionalSubtotal.toFixed(2)),
          withMarkup: Number(wasteProvisionalWithMarkup.toFixed(2))
        },
        option: {
          subtotal: Number(wasteOptionSubtotal.toFixed(2)),
          withMarkup: Number(wasteOptionWithMarkup.toFixed(2))
        },
        internal: {
          subtotal: Number(wasteInternalSubtotal.toFixed(2)),
          withMarkup: Number(wasteInternalWithMarkup.toFixed(2))
        }
      },
      operationalCosts: {
        itemCount: operationalLines.length,
        subtotal: Number(operationalSubtotal.toFixed(2)),
        withMarkup: Number(operationalWithMarkup.toFixed(2)),
        provisional: {
          subtotal: Number(operationalProvisionalSubtotal.toFixed(2)),
          withMarkup: Number(operationalProvisionalWithMarkup.toFixed(2))
        },
        option: {
          subtotal: Number(operationalOptionSubtotal.toFixed(2)),
          withMarkup: Number(operationalOptionWithMarkup.toFixed(2))
        },
        internal: {
          subtotal: Number(operationalInternalSubtotal.toFixed(2)),
          withMarkup: Number(operationalInternalWithMarkup.toFixed(2))
        },
        byCard: Object.fromEntries(
          [...operationalByCard.entries()].map(([cardId, b]) => [
            cardId,
            { subtotal: Number(b.subtotal.toFixed(2)), withMarkup: Number(b.withMarkup.toFixed(2)) }
          ])
        )
      },
      tenderPrice: Number(tenderPrice.toFixed(2)),
      provisionalTotal: Number(provisionalTotal.toFixed(2)),
      optionsTotal: Number(optionsTotal.toFixed(2)),
      internalTotal: Number(internalTotal.toFixed(2))
    };
  }

  // ── Pushable lines (QUOTE_PUSH_BY_DESTINATION_V1) ────────────────────

  /**
   * QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) — list every non-excluded
   * estimate line across all four types with its price (lineTotalWithMarkup)
   * and quoteDestination. Reuses the same pricing reads as summary() without
   * duplicating the pricing logic. INTERNAL lines are included so S4b can
   * show the "Left off this quote" strip.
   *
   * @returns every non-excluded estimate line with pricing and destination
   */
  async listPushableLines(tenderId: string): Promise<Array<{
    type: "scope" | "waste" | "cutting" | "operational";
    id: string;
    code: string;
    description: string;
    cardId: string;
    cardCode: string;
    discipline: string;
    quoteDestination: "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
    price: number;
    priceable: boolean;
    priceReason: string | null;
  }>> {
    await this.requireTender(tenderId);

    // Shared pricing inputs (mirrors summary() reads exactly).
    const snapshotOpts = { tenderId };
    const [labourListed, plantListed, tenderEstimate] = await Promise.all([
      this.rateResolver.listRates("labour", snapshotOpts),
      this.rateResolver.listRates("plant", snapshotOpts),
      this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
    ]);
    const labourRates = labourListed.map((r) => ({
      role: String(r.keys["role"] ?? ""),
      shift: String(r.keys["shift"] ?? "day"),
      rate: new Prisma.Decimal(r.value)
    }));
    const plantRates = plantListed.map((r) => ({
      id: r.rowId,
      rate: new Prisma.Decimal(r.value)
    }));
    const rateMaps = buildRateMaps(labourRates, plantRates);
    const tenderMarkup = tenderEstimate ? Number(tenderEstimate.markup) : 30;

    const result: Array<{
      type: "scope" | "waste" | "cutting" | "operational";
      id: string;
      code: string;
      description: string;
      cardId: string;
      cardCode: string;
      discipline: string;
      quoteDestination: "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
      price: number;
      priceable: boolean;
      priceReason: string | null;
    }> = [];

    // 1. Scope items. Include the full card (needed for toPricingInput which expects
    // the full ScopeCard shape including markupOverride).
    const scopeItems = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: { not: "excluded" } },
      include: {
        card: true,
        subLineQuotes: { where: { isSelected: true }, select: { amount: true } }
      },
      orderBy: [{ wbsCode: "asc" }, { sortOrder: "asc" }]
    });
    for (const item of scopeItems) {
      if (!item.card) continue;
      const itemDiscipline = item.card.discipline as Discipline;
      const cardCode = `${item.card.discipline}${item.card.cardNumber}`;
      const effectiveMarkup = resolveEffectiveMarkup(
        item.markupOverride != null ? Number(item.markupOverride) : null,
        item.card.markupOverride != null ? Number(item.card.markupOverride) : null,
        tenderMarkup
      );

      let price = 0;
      let priceable = true;
      let priceReason: string | null = null;

      if (itemDiscipline === "SUB") {
        const selectedQuote = item.subLineQuotes[0];
        if (!selectedQuote) {
          priceable = false;
          priceReason = "no quote selected";
        } else {
          const quoteAmount = Number(selectedQuote.amount);
          const markupFactor = 1 + (Number.isFinite(effectiveMarkup) ? effectiveMarkup : 0) / 100;
          price = round2(quoteAmount * markupFactor);
        }
      } else {
        const computed = computeScopeItemTotal(
          toPricingInput(item, itemDiscipline),
          rateMaps,
          effectiveMarkup
        );
        price = round2(computed.lineTotalWithMarkup);
        // Check priceable: no quantity or no rate.
        if (price === 0 && computed.lineTotal === 0) {
          const input = toPricingInput(item, itemDiscipline);
          const hasMen = Number(input.men ?? 0) > 0;
          const hasDays = Number(input.days ?? 0) > 0;
          if (!hasMen && !hasDays) {
            priceable = false;
            priceReason = "no quantity";
          }
        }
      }

      const dest = ((item.quoteDestination ?? "PRICE") as string) as "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
      result.push({
        type: "scope",
        id: item.id,
        code: item.wbsCode,
        description: item.description,
        cardId: item.card.id,
        cardCode,
        discipline: item.card.discipline,
        quoteDestination: dest,
        price,
        priceable,
        priceReason
      });
    }

    // 2. Waste items.
    const wasteItems = await this.prisma.scopeWasteItem.findMany({
      where: { tenderId },
      include: {
        card: { select: { id: true, discipline: true, cardNumber: true, wasteMarkupOverride: true } }
      },
      orderBy: [{ cardId: "asc" }, { sortOrder: "asc" }]
    });
    for (const w of wasteItems) {
      if (!w.card) continue;
      const cardCode = `${w.card.discipline}${w.card.cardNumber}`;
      const cardWasteOverride = w.card.wasteMarkupOverride != null ? Number(w.card.wasteMarkupOverride) : null;
      const lineMarkupOverride = w.markupOverride != null ? Number(w.markupOverride) : null;
      const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardWasteOverride, tenderMarkup);
      const amt = w.lineTotal ? Number(w.lineTotal) : 0;
      const lineTotalWithMarkup = round2(amt * (1 + effectiveMarkup / 100));

      const priceable = lineTotalWithMarkup > 0 || amt > 0;
      const priceReason = !priceable ? "no rate" : null;
      const dest = ((w.quoteDestination ?? "PRICE") as string) as "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
      // Waste code: cardCode + " waste"
      result.push({
        type: "waste",
        id: w.id,
        code: `${cardCode} waste`,
        description: w.description,
        cardId: w.card.id,
        cardCode,
        discipline: w.discipline,
        quoteDestination: dest,
        price: lineTotalWithMarkup,
        priceable: true, // waste items are always considered priceable (0 just means no disposal yet)
        priceReason: null
      });
    }

    // 3. Cutting items.
    const cuttingItems = await this.prisma.cuttingSheetItem.findMany({
      where: { tenderId },
      include: {
        card: { select: { id: true, discipline: true, cardNumber: true, cuttingMarkupOverride: true } }
      },
      orderBy: [{ wbsRef: "asc" }, { sortOrder: "asc" }]
    });
    for (const ci of cuttingItems) {
      const cardCode = `${ci.card.discipline}${ci.card.cardNumber}`;
      const cardCuttingOverride = ci.card.cuttingMarkupOverride != null ? Number(ci.card.cuttingMarkupOverride) : null;
      const lineMarkupOverride = ci.markupOverride != null ? Number(ci.markupOverride) : null;
      const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardCuttingOverride, tenderMarkup);
      const amt = ci.lineTotal ? Number(ci.lineTotal) : 0;
      const lineTotalWithMarkup = round2(amt * (1 + effectiveMarkup / 100));

      const priceable = amt > 0 || !!ci.equipment;
      const priceReason = !priceable ? "no rate" : null;
      const dest = ((ci.quoteDestination ?? "PRICE") as string) as "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
      result.push({
        type: "cutting",
        id: ci.id,
        code: `${ci.wbsRef} cutting`,
        description: ci.description ?? ci.wbsRef,
        cardId: ci.card.id,
        cardCode,
        discipline: ci.card.discipline,
        quoteDestination: dest,
        price: lineTotalWithMarkup,
        priceable,
        priceReason
      });
    }

    // 4. Operational lines.
    const operationalLines = await this.prisma.scopeOperationalCostLine.findMany({
      where: { card: { tenderId } },
      include: {
        card: { select: { id: true, discipline: true, cardNumber: true, markupOverride: true } }
      },
      orderBy: [{ cardId: "asc" }, { sortOrder: "asc" }]
    });
    for (const ol of operationalLines) {
      const cardCode = `${ol.card.discipline}${ol.card.cardNumber}`;
      const lineTotal = computeOperationalLineTotal(ol);
      const effectiveMarkup = computeOperationalLineMarkup(
        decToNum(ol.markupOverride),
        ol.card.markupOverride != null ? Number(ol.card.markupOverride) : null,
        tenderMarkup
      );
      const lineTotalWithMarkup = round2(lineTotal * (1 + effectiveMarkup / 100));

      const dest = ((ol.quoteDestination ?? "PRICE") as string) as "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
      result.push({
        type: "operational",
        id: ol.id,
        code: `${cardCode} op`,
        description: ol.description,
        cardId: ol.card.id,
        cardCode,
        discipline: ol.card.discipline,
        quoteDestination: dest,
        price: lineTotalWithMarkup,
        priceable: lineTotal > 0 || (ol.qty != null && Number(ol.qty) > 0),
        priceReason: null
      });
    }

    return result;
  }

  // ── Private ──────────────────────────────────────────────────────────
  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }

  private assertDiscipline(discipline: string) {
    if (!(DISCIPLINES as readonly string[]).includes(discipline)) {
      throw new BadRequestException(`Unknown discipline "${discipline}".`);
    }
  }

  private async pricedCuttingData(dto: {
    itemType: "saw-cut" | "core-hole" | "other-rate";
    equipment?: string | null;
    elevation?: string | null;
    material?: string | null;
    depthMm?: number | null;
    diameterMm?: number | null;
    quantityLm?: number | null;
    quantityEach?: number | null;
    shiftLoading?: number | null;
    method?: string | null;
    otherRateId?: string | null;
    tenderId?: string | null;
  }): Promise<{
    ratePerM: Prisma.Decimal | null;
    ratePerHole: Prisma.Decimal | null;
    lineTotal: Prisma.Decimal | null;
  }> {
    const shiftLoading = dto.shiftLoading !== undefined && dto.shiftLoading !== null ? Number(dto.shiftLoading) : 0;

    if (dto.itemType === "other-rate") {
      // Other-rate lines reference the admin-managed catalogue directly;
      // multipliers and shift loading don't apply here.
      // rates-consumers SLICE 2 — replace findUnique(id) with listRates.
      // listRates("other-rates") returns only active rows (matching the
      // original `!rate.isActive` guard). We match by rowId to preserve the
      // "look up by PK" semantic of the original call.
      if (!dto.otherRateId) return { ratePerM: null, ratePerHole: null, lineTotal: null };
      // Pass tenderId so locked-rate snapshots are applied (SLICE 2).
      const allOtherRates = await this.rateResolver.listRates("other-rates", dto.tenderId ? { tenderId: dto.tenderId } : undefined);
      const rate = allOtherRates.find((r) => r.rowId === dto.otherRateId) ?? null;
      if (!rate) return { ratePerM: null, ratePerHole: null, lineTotal: null };
      const qty = Number(dto.quantityEach ?? dto.quantityLm ?? 1);
      return {
        ratePerM: null,
        ratePerHole: null,
        lineTotal: cuttingLineTotal({ qty, rate: rate.value })
      };
    }

    if (dto.itemType === "saw-cut") {
      if (!dto.equipment || !dto.depthMm) {
        return { ratePerM: null, ratePerHole: null, lineTotal: null };
      }
      const resolved = await resolveCuttingRate(this.rateResolver, {
        equipment: dto.equipment,
        elevation: dto.elevation ?? "Floor",
        material: dto.material ?? "Concrete",
        depthMm: dto.depthMm,
        method: dto.method ?? null,
        tenderId: dto.tenderId ?? null
      }, this.chargeStepPricing);
      if (!resolved) return { ratePerM: null, ratePerHole: null, lineTotal: null };
      const qty = Number(dto.quantityLm ?? 0);
      return {
        ratePerM: new Prisma.Decimal(resolved.finalRate.toFixed(4)),
        ratePerHole: null,
        lineTotal: cuttingLineTotal({ qty, rate: resolved.finalRate, addOn: shiftLoading })
      };
    }

    // CHARGE_STEPS_PRICE_CUTTING_V1 — core-hole pricing via step formula.
    // When chargeStepPricing is available, resolveCoreHoleRate returns a
    // ratePerHole that is the full per-hole cost for 1 hole at the given depth,
    // with elevation baked in by the step formula. The caller multiplies by qty
    // only. depthUnits and elevationMultiplier are already in the step result.
    // When chargeStepPricing is absent (unit-test compat), the original formula
    // applies: ratePerHole * depthUnits * qty * elevationMultiplier.
    if (!dto.diameterMm) return { ratePerM: null, ratePerHole: null, lineTotal: null };
    const depthMm = dto.depthMm && dto.depthMm > 0 ? dto.depthMm : 0;
    const resolved = await resolveCoreHoleRate(this.rateResolver, {
      diameterMm: dto.diameterMm,
      elevation: dto.elevation ?? "Floor",
      method: dto.method ?? null,
      tenderId: dto.tenderId ?? null
    }, this.chargeStepPricing);
    if (!resolved) return { ratePerM: null, ratePerHole: null, lineTotal: null };
    if (resolved.isPOA) {
      // > 650mm diameter — manual pricing. Zero line total, null per-hole rate.
      return {
        ratePerM: null,
        ratePerHole: null,
        lineTotal: new Prisma.Decimal(0)
      };
    }
    const qty = dto.quantityEach ?? 0;
    let finalPerHoleRate: number;
    if (this.chargeStepPricing) {
      // Step path: ratePerHole already includes depth rounding, elevation, and method.
      // Only multiply by qty (holes count).
      finalPerHoleRate = resolved.ratePerHole;
    } else {
      // Unit-test compat path: apply depth/elevation/method here.
      // CUTTING_RATE_CORRECTIONS_V1 — D1: depth rounding and minimum.
      const depthUnits = Math.max(1, Math.round(depthMm / 10));
      finalPerHoleRate = resolved.ratePerHole * depthUnits * resolved.elevationMultiplier * resolved.methodMultiplier;
    }
    return {
      ratePerM: null,
      ratePerHole: new Prisma.Decimal(finalPerHoleRate.toFixed(4)),
      lineTotal: cuttingLineTotal({ qty, rate: finalPerHoleRate, addOn: shiftLoading })
    };
  }

  /**
   * @deprecated PR B1.7.2 — legacy EstimateItem-based per-row pricing.
   * Canonical (B1.6+) rows never create EstimateItem so this path
   * silently returned $0 for them. summary() now uses the pure
   * computeScopeItemTotal helper directly. Method kept for safety
   * until a separate cleanup PR confirms there are no callers.
   */
  private async computeEstimateItemPrices(itemIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (itemIds.length === 0) return map;
    const items = await this.prisma.estimateItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        labourLines: true,
        plantLines: true,
        equipLines: true,
        wasteLines: true,
        cuttingLines: true
      }
    });
    for (const item of items) {
      const labour = item.labourLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.days) * Number(l.rate),
        0
      );
      const plant = item.plantLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.days) * Number(l.rate),
        0
      );
      const equip = item.equipLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.duration) * Number(l.rate),
        0
      );
      const waste = item.wasteLines.reduce(
        (sum, l) => sum + Number(l.qtyTonnes) * Number(l.tonRate) + Number(l.loads) * Number(l.loadRate),
        0
      );
      const cutting = item.cuttingLines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
      // Per-item subtotal only — markup applied at the discipline summary
      // level so the grand total reflects tender-level markup.
      map.set(item.id, labour + plant + equip + waste + cutting);
    }
    return map;
  }

  // ── SUB line linkage (scope-subcontracted order 4) ───────────────────

  /**
   * Link a scope item (coveredItemId) to a SUB line (subItemId).
   * Validates:
   *  - Both items belong to the same tender.
   *  - The target (subItemId) is a SUB-discipline item.
   *  - The source and target are not the same item.
   *
   * SCOPE_QUOTE_DESTINATION_V1: linking no longer zeroes the covered item.
   * When setInternal is true, the covered item's quoteDestination is set to
   * INTERNAL at the same time as the link is written. Unlink never changes
   * the destination -- the estimator decides.
   *
   * @throws BadRequestException on any validation failure
   * @throws NotFoundException when either item or the tender is not found
   */
  async linkItemToSubLine(tenderId: string, coveredItemId: string, subItemId: string, setInternal = false) {
    await this.requireTender(tenderId);
    const [covered, subLine] = await Promise.all([
      this.prisma.scopeOfWorksItem.findUnique({
        where: { id: coveredItemId },
        include: { card: true }
      }),
      this.prisma.scopeOfWorksItem.findUnique({
        where: { id: subItemId },
        include: { card: true }
      })
    ]);
    if (!covered) throw new NotFoundException(`Scope item ${coveredItemId} not found.`);
    if (!subLine) throw new NotFoundException(`Scope item ${subItemId} not found.`);
    if (covered.tenderId !== tenderId || subLine.tenderId !== tenderId) {
      throw new BadRequestException("Both items must belong to the specified tender.");
    }
    if (coveredItemId === subItemId) {
      throw new BadRequestException("An item cannot be linked to itself.");
    }
    if (subLine.card?.discipline !== "SUB") {
      throw new BadRequestException(
        `Target item ${subItemId} is not a SUB-discipline item (discipline: ${subLine.card?.discipline ?? "unknown"}).`
      );
    }
    return this.prisma.scopeOfWorksItem.update({
      where: { id: coveredItemId },
      data: {
        pricedBySubItemId: subItemId,
        ...(setInternal ? { quoteDestination: QuoteDestination.INTERNAL } : {})
      }
    });
  }

  /**
   * Unlink a scope item from its SUB line (set pricedBySubItemId to null).
   * @throws NotFoundException when the item or tender is not found
   */
  async unlinkItemFromSubLine(tenderId: string, coveredItemId: string) {
    await this.requireTender(tenderId);
    const item = await this.prisma.scopeOfWorksItem.findUnique({
      where: { id: coveredItemId },
      select: { id: true, tenderId: true }
    });
    if (!item) throw new NotFoundException(`Scope item ${coveredItemId} not found.`);
    if (item.tenderId !== tenderId) {
      throw new BadRequestException("Item does not belong to the specified tender.");
    }
    return this.prisma.scopeOfWorksItem.update({
      where: { id: coveredItemId },
      data: { pricedBySubItemId: null }
    });
  }

  /**
   * Add a quote to a SUB line scope item.
   * @throws BadRequestException when the item is not a SUB-discipline item
   * @throws NotFoundException when the item or tender is not found
   */
  async addSubLineQuote(
    tenderId: string,
    scopeItemId: string,
    dto: {
      subcontractorSupplierId?: string | null;
      supplierNameFallback?: string | null;
      amount: number;
      receivedAt?: Date | null;
      notes?: string | null;
      tenderDocumentLinkId?: string | null;
    }
  ) {
    await this.requireTender(tenderId);
    const item = await this.prisma.scopeOfWorksItem.findUnique({
      where: { id: scopeItemId },
      include: { card: true }
    });
    if (!item) throw new NotFoundException(`Scope item ${scopeItemId} not found.`);
    if (item.tenderId !== tenderId) {
      throw new BadRequestException("Item does not belong to the specified tender.");
    }
    if (item.card?.discipline !== "SUB") {
      throw new BadRequestException(
        `Item ${scopeItemId} is not a SUB-discipline item — quotes can only be added to SUB lines.`
      );
    }
    return this.prisma.subLineQuote.create({
      data: {
        scopeItemId,
        subcontractorSupplierId: dto.subcontractorSupplierId ?? null,
        supplierNameFallback: dto.supplierNameFallback ?? null,
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        isSelected: false,
        receivedAt: dto.receivedAt ?? null,
        notes: dto.notes ?? null,
        tenderDocumentLinkId: dto.tenderDocumentLinkId ?? null
      }
    });
  }

  /**
   * Update a sub line quote (amount, notes, receivedAt, tenderDocumentLinkId,
   * supplier). Does not change isSelected (use selectSubLineQuote).
   */
  async updateSubLineQuote(
    tenderId: string,
    quoteId: string,
    dto: {
      subcontractorSupplierId?: string | null;
      supplierNameFallback?: string | null;
      amount?: number;
      receivedAt?: Date | null;
      notes?: string | null;
      tenderDocumentLinkId?: string | null;
    }
  ) {
    const quote = await this.prisma.subLineQuote.findUnique({
      where: { id: quoteId },
      include: { scopeItem: { select: { tenderId: true } } }
    });
    if (!quote) throw new NotFoundException(`SubLineQuote ${quoteId} not found.`);
    if (quote.scopeItem.tenderId !== tenderId) {
      throw new BadRequestException("Quote does not belong to the specified tender.");
    }
    return this.prisma.subLineQuote.update({
      where: { id: quoteId },
      data: {
        ...(dto.subcontractorSupplierId !== undefined && {
          subcontractorSupplierId: dto.subcontractorSupplierId
        }),
        ...(dto.supplierNameFallback !== undefined && {
          supplierNameFallback: dto.supplierNameFallback
        }),
        ...(dto.amount !== undefined && {
          amount: new Prisma.Decimal(dto.amount.toFixed(2))
        }),
        ...(dto.receivedAt !== undefined && { receivedAt: dto.receivedAt }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tenderDocumentLinkId !== undefined && {
          tenderDocumentLinkId: dto.tenderDocumentLinkId
        })
      }
    });
  }

  /**
   * Delete a sub line quote. Deselects any other selected quote if the deleted
   * one was selected (by cascading the DB row removal — the partial unique index
   * then naturally allows a new selection).
   */
  async deleteSubLineQuote(tenderId: string, quoteId: string) {
    const quote = await this.prisma.subLineQuote.findUnique({
      where: { id: quoteId },
      include: { scopeItem: { select: { tenderId: true } } }
    });
    if (!quote) throw new NotFoundException(`SubLineQuote ${quoteId} not found.`);
    if (quote.scopeItem.tenderId !== tenderId) {
      throw new BadRequestException("Quote does not belong to the specified tender.");
    }
    return this.prisma.subLineQuote.delete({ where: { id: quoteId } });
  }

  /**
   * Select a quote for a SUB line. Deselects any currently-selected quote
   * for the same scope item in the same transaction, then marks this one
   * selected. The partial unique index (scope_item_id WHERE is_selected)
   * is the DB-level guard; the in-transaction deselect prevents a conflict.
   *
   * @throws BadRequestException when the quote is not found on this tender
   */
  async selectSubLineQuote(tenderId: string, quoteId: string) {
    const quote = await this.prisma.subLineQuote.findUnique({
      where: { id: quoteId },
      include: { scopeItem: { select: { tenderId: true, id: true } } }
    });
    if (!quote) throw new NotFoundException(`SubLineQuote ${quoteId} not found.`);
    if (quote.scopeItem.tenderId !== tenderId) {
      throw new BadRequestException("Quote does not belong to the specified tender.");
    }
    const scopeItemId = quote.scopeItem.id;
    // Transactionally deselect any existing selected quote then select this one.
    return this.prisma.$transaction([
      this.prisma.subLineQuote.updateMany({
        where: { scopeItemId, isSelected: true, id: { not: quoteId } },
        data: { isSelected: false }
      }),
      this.prisma.subLineQuote.update({
        where: { id: quoteId },
        data: { isSelected: true }
      })
    ]);
  }

  /**
   * List all quotes for a SUB scope line.
   */
  async listSubLineQuotes(tenderId: string, scopeItemId: string) {
    await this.requireTender(tenderId);
    const item = await this.prisma.scopeOfWorksItem.findUnique({
      where: { id: scopeItemId },
      select: { id: true, tenderId: true }
    });
    if (!item) throw new NotFoundException(`Scope item ${scopeItemId} not found.`);
    if (item.tenderId !== tenderId) {
      throw new BadRequestException("Item does not belong to the specified tender.");
    }
    return this.prisma.subLineQuote.findMany({
      where: { scopeItemId },
      orderBy: { createdAt: "asc" }
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
