import { BadRequestException } from "@nestjs/common";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

/**
 * SCOPE_OPERATIONAL_COSTS_V1 — units that carry a duration.
 *
 * `pr-cardui-s6-other-operational-costs` pins the days field at 1 and greys
 * it out when a line's unit carries no duration (`Ea`, `Lump sum`). A rule
 * enforced only in the browser is not enforced: whatever this API accepts is
 * what the database will eventually hold, so the same constraint lives here.
 *
 * GROUNDING — read this before extending the list.
 *   Grounded in existing code:
 *     "day"  — `EstimatePlantRate.unit` defaults to "day" and every seeded
 *              plant row except the two "each way" floats uses it
 *              (apps/api/prisma/seed-initial-services.ts); the rate resolver
 *              returns `unit: "day"` for every labour rate.
 *     "hr"   — documented as a valid unit on the subcontractor-rate DTOs
 *              (apps/api/src/modules/subcontractor-rates/dto/*.ts:
 *              'e.g. "hr", "day", "m2", "tonne"').
 *   Grounded as NOT duration-bearing:
 *     "each way" (EstimatePlantRate seed), "m2"/"tonne" (subcontractor-rate
 *     DTOs), "m³"/"tonne" (EstimateWasteRate seed), and `Ea` / `Lump sum`,
 *     which s6 names explicitly.
 *   A GUESS, stated as such: the plural/long spellings below ("days",
 *   "hour", "hours", "week", "weeks", "wk", "shift", "shifts"). No unit
 *   taxonomy exists anywhere in this repo — units are free text on every
 *   model that has them — so this is the minimal defensible list, not a
 *   settled vocabulary. When a real taxonomy lands, this constant is the one
 *   place to change.
 *
 * The check is DEFAULT-DENY on purpose: an unrecognised unit is treated as
 * NOT duration-bearing, so it can only ever reject a days value, never
 * silently accept one. Matching is case-insensitive and whitespace-trimmed.
 */
export const DURATION_BEARING_UNITS: readonly string[] = [
  "day",
  "days",
  "hr",
  "hrs",
  "hour",
  "hours",
  "shift",
  "shifts",
  "week",
  "weeks",
  "wk",
  "wks"
];

const DURATION_BEARING_SET = new Set(DURATION_BEARING_UNITS);

/**
 * True when `unit` carries a duration and a `days` value other than 1 is
 * meaningful. Null / undefined / unknown units return false (default-deny).
 */
export function isDurationBearingUnit(unit: string | null | undefined): boolean {
  if (typeof unit !== "string") return false;
  return DURATION_BEARING_SET.has(unit.trim().toLowerCase());
}

/**
 * SCOPE_OPERATIONAL_COSTS_V1 — the lump-sum rule, enforced server-side.
 *
 * Rejects a `days` value other than 1 on a line whose unit carries no
 * duration. `null` and `undefined` days are always fine (the line simply has
 * no duration recorded); 1 is always fine (that is the pinned value s6
 * renders). Anything else on a non-duration unit is a 400.
 *
 * @param unit - the line's effective unit AFTER the patch is applied
 * @param days - the line's effective days AFTER the patch is applied
 * @throws BadRequestException when a non-duration unit carries days !== 1
 */
export function assertDaysAllowedForUnit(
  unit: string | null | undefined,
  days: number | null | undefined
): void {
  if (days === null || days === undefined) return;
  if (days === 1) return;
  if (isDurationBearingUnit(unit)) return;
  throw new BadRequestException(
    `Unit "${String(unit ?? "")}" carries no duration — days must be 1 or omitted. ` +
      `Duration-bearing units are: ${DURATION_BEARING_UNITS.join(", ")}.`
  );
}

/**
 * Create/patch body for an operational-cost line. Every field is optional so
 * the same shape serves POST and PATCH; `description` is required by the
 * service on create only.
 *
 * Validation style copied from UpsertWasteDto in scope-waste.controller.ts:
 * `@Type(() => Number)` in front of every numeric so query/form bodies
 * coerce, and nullable strings typed `string | null`.
 */
export class UpsertOperationalCostLineDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qty?: number | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() days?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() rate?: number | null;
  // null means inherit `rate`. A stored 0 is a real value ("free"), not an
  // absence — the same semantics as plantItems[].dayRateOverride.
  @IsOptional() @Type(() => Number) @IsNumber() rateOverride?: number | null;
  @IsOptional() @IsString() plantRateId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}
