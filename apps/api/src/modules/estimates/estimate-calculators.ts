// Pure calculators for the estimating module — the SoT business logic
// from `/sot/01-charter-and-architecture.md` SECTION 10 encoded as
// side-effect-free functions so the summary layer, controllers and unit
// specs share one implementation.
//
// BACKLOG-DECISIONS.md #7 (Marco, 2026-07-20): these two calculators
// ship in their own reviewable PR — they change quoted prices, so they
// must not ride along with a refactor.

/**
 * Conventional working-day length used to convert person-days into
 * person-hours. Kept as a named constant so a future site-specific shift
 * length can override it in one place.
 */
export const HOURS_PER_WORKING_DAY = 8;

/**
 * Compute task hours from a scope quantity and a production rate.
 *
 * SoT (§10): `task time = quantity ÷ production rate (units/hour)`.
 *
 * @param quantity - scope quantity in the units the rate is expressed in
 *                   (e.g. m² of plasterboard, m³ of concrete, EA of doors)
 * @param productionRateUnitsPerHour - crew production rate for the same
 *                   units, expressed per hour (e.g. 20 m²/h)
 * @returns hours to complete the task, or `null` when either input is
 *          missing, non-finite, negative, or the rate is zero
 */
export function taskTimeCalculator(
  quantity: number | null | undefined,
  productionRateUnitsPerHour: number | null | undefined
): number | null {
  if (quantity === null || quantity === undefined) return null;
  if (productionRateUnitsPerHour === null || productionRateUnitsPerHour === undefined) return null;
  if (!Number.isFinite(quantity) || !Number.isFinite(productionRateUnitsPerHour)) return null;
  if (quantity < 0 || productionRateUnitsPerHour <= 0) return null;
  return quantity / productionRateUnitsPerHour;
}

/**
 * Compute waste weight (tonnes) from a volume and a bulk density.
 *
 * SoT (§10): `waste weight = volume (m³) × density (kg/m³) ÷ 1000`.
 * The divide-by-1000 converts kilograms to tonnes; when the density in
 * hand is already expressed in t/m³, use {@link wasteWeightFromTonneDensity}
 * instead so callers don't silently scale it a second time.
 *
 * Density values must come from the `EstimateMaterialDensity` lookup
 * table — never hard-code them per call site. Seed data cites Australian
 * Standards (AS 1379 / AS 3700 / AS 1289 / AS 4100).
 *
 * @param volumeM3 - volume in cubic metres
 * @param densityKgPerM3 - bulk density in kilograms per cubic metre
 * @returns weight in tonnes, or `null` when either input is missing,
 *          non-finite, or negative
 */
export function wasteWeightCalculator(
  volumeM3: number | null | undefined,
  densityKgPerM3: number | null | undefined
): number | null {
  if (volumeM3 === null || volumeM3 === undefined) return null;
  if (densityKgPerM3 === null || densityKgPerM3 === undefined) return null;
  if (!Number.isFinite(volumeM3) || !Number.isFinite(densityKgPerM3)) return null;
  if (volumeM3 < 0 || densityKgPerM3 < 0) return null;
  return (volumeM3 * densityKgPerM3) / 1000;
}

/**
 * Convenience wrapper for the common case where the density lookup
 * returns tonnes-per-cubic-metre (the units printed in the SoT density
 * reference table). Scales up to kg/m³ before delegating to
 * {@link wasteWeightCalculator} so both call sites share one path.
 *
 * @param volumeM3 - volume in cubic metres
 * @param densityTonnesPerM3 - bulk density in t/m³
 */
export function wasteWeightFromTonneDensity(
  volumeM3: number | null | undefined,
  densityTonnesPerM3: number | null | undefined
): number | null {
  if (densityTonnesPerM3 === null || densityTonnesPerM3 === undefined) return null;
  if (!Number.isFinite(densityTonnesPerM3)) return null;
  return wasteWeightCalculator(volumeM3, densityTonnesPerM3 * 1000);
}

/**
 * Sum the task hours implied by a set of labour-line allocations,
 * treating each `(qty persons × days)` cell as person-days and
 * multiplying by the conventional working-day length.
 *
 * Expressed as `taskTimeCalculator(personDays, 1 / HOURS_PER_WORKING_DAY)`
 * so the calculator function is the single source of truth for the
 * scalar arithmetic and the choice of working-day length is visible at
 * the summary layer.
 *
 * @param lines - labour lines with `qty` (persons) and `days`
 * @returns total person-hours committed, or `0` when the list is empty
 */
export function sumLabourTaskHours(
  lines: ReadonlyArray<{ qty: number; days: number }>
): number {
  let total = 0;
  for (const line of lines) {
    const personDays = line.qty * line.days;
    const hours = taskTimeCalculator(personDays, 1 / HOURS_PER_WORKING_DAY);
    if (hours !== null) total += hours;
  }
  return total;
}
