// CUTTING_ONE_TOTAL_V1 (scopecards-s7) — one pricing function for both cutting models.
// Sentinel grepped by the DONE_WHEN gate and the CI gate.
export const CUTTING_ONE_TOTAL_V1 = "scopecards-s7";

import { Prisma } from "@prisma/client";
import { resolveCuttingRate, resolveCoreHoleRate } from "./scope-redesign.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { ChargeStepPricingService } from "../rates/charge-step-pricing.service";

/**
 * THE cutting line total.
 *
 * Decimal arithmetic, half-up to the cent — the same rule as Postgres ROUND.
 * `new Decimal(qty).mul(rate).add(addOn ?? 0).toDecimalPlaces(2, ROUND_HALF_UP)`
 *
 * - No Number() conversion.
 * - No toFixed() (which rounds a binary float, disagreeing at half-cents).
 * - addOn is added before rounding (legacy shiftLoading, deprecated by S6 but data kept).
 */
export function cuttingLineTotal(input: {
  qty: Prisma.Decimal | number | string;
  rate: Prisma.Decimal | number | string;
  addOn?: Prisma.Decimal | number | string | null;
}): Prisma.Decimal {
  const qty = new Prisma.Decimal(input.qty.toString());
  const rate = new Prisma.Decimal(input.rate.toString());
  const addOn =
    input.addOn != null && input.addOn !== ""
      ? new Prisma.Decimal(input.addOn.toString())
      : new Prisma.Decimal(0);

  return qty.mul(rate).add(addOn).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Dependencies injected into priceCuttingLine. */
export interface PriceCuttingLineDeps {
  rateResolver: RateResolverService;
  chargeStepPricing?: ChargeStepPricingService | null;
}

/**
 * Rate + total for one line.
 *
 * Uses the caller's rate when one is supplied; resolves it otherwise.
 * Returns null exactly where resolveCuttingRate / resolveCoreHoleRate do.
 *
 * A supplied rate is stored as given — never re-resolved, not on create,
 * not on update, not in the backfill.
 */
export async function priceCuttingLine(
  deps: PriceCuttingLineDeps,
  input: {
    kind: "saw-cut" | "core-hole";
    equipment?: string | null;
    elevation?: string | null;
    material?: string | null;
    depthMm?: number | null;
    diameterMm?: number | null;
    method?: string | null;
    qty: number;
    rate?: number | null; // supplied → used as given, never re-resolved
    addOn?: number | null;
    tenderId?: string | null;
  }
): Promise<{ rate: Prisma.Decimal; lineTotal: Prisma.Decimal } | null> {
  const { rateResolver, chargeStepPricing } = deps;

  // If a rate was explicitly supplied, use it as given.
  if (input.rate != null) {
    const suppliedRate = new Prisma.Decimal(input.rate.toString());
    const total = cuttingLineTotal({
      qty: input.qty,
      rate: suppliedRate,
      addOn: input.addOn
    });
    return { rate: suppliedRate, lineTotal: total };
  }

  if (input.kind === "saw-cut") {
    if (!input.equipment || !input.depthMm) return null;

    const resolved = await resolveCuttingRate(
      rateResolver,
      {
        equipment: input.equipment,
        elevation: input.elevation ?? "Floor",
        material: input.material ?? "Concrete",
        depthMm: input.depthMm,
        method: input.method ?? null,
        tenderId: input.tenderId ?? null
      },
      chargeStepPricing
    );
    if (!resolved) return null;

    const rate = new Prisma.Decimal(resolved.finalRate.toString());
    const total = cuttingLineTotal({
      qty: input.qty,
      rate,
      addOn: input.addOn
    });
    return { rate, lineTotal: total };
  }

  // core-hole
  if (!input.diameterMm) return null;
  const depthMm = input.depthMm && input.depthMm > 0 ? input.depthMm : 0;

  const resolved = await resolveCoreHoleRate(
    rateResolver,
    {
      diameterMm: input.diameterMm,
      elevation: input.elevation ?? "Floor",
      method: input.method ?? null,
      tenderId: input.tenderId ?? null
    },
    chargeStepPricing
  );
  if (!resolved) return null;

  if (resolved.isPOA) {
    // > 650mm diameter — manual pricing. Zero total.
    return {
      rate: new Prisma.Decimal(0),
      lineTotal: new Prisma.Decimal(0)
    };
  }

  let finalPerHoleRate: number;
  if (chargeStepPricing) {
    // Step path: ratePerHole already includes depth rounding, elevation, and method.
    finalPerHoleRate = resolved.ratePerHole;
  } else {
    // Unit-test compat path: apply depth/elevation/method here.
    const depthUnits = Math.max(1, Math.round(depthMm / 10));
    finalPerHoleRate = resolved.ratePerHole * depthUnits * resolved.elevationMultiplier * resolved.methodMultiplier;
  }

  const rate = new Prisma.Decimal(finalPerHoleRate.toString());
  const total = cuttingLineTotal({
    qty: input.qty,
    rate,
    addOn: input.addOn
  });
  return { rate, lineTotal: total };
}
