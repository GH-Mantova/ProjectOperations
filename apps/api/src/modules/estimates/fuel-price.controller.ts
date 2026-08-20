import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { FuelPriceService } from "./fuel-price.service";

/**
 * Admin endpoint for manually triggering a fuel-price refresh.
 *
 * Route: POST /fuel-price/refresh
 *
 * Guarded by platform.admin — the same permission used by
 * GET/PATCH /admin/settings/operations (admin-settings.controller.ts:97,105).
 *
 * Module placement: kept in EstimatesModule because FuelPriceService already
 * lives here. Moving it to AdminSettingsModule would require importing
 * EstimatesModule (and its transitive imports: AuditModule, RatesModule) just
 * for one service — a heavier dependency than a dedicated controller in-module.
 * The route path (fuel-price/refresh) is unambiguously admin-scoped via
 * RequirePermissions("platform.admin"), so the controller's module location
 * does not affect access semantics.
 */
@ApiTags("Fuel Price")
@ApiBearerAuth()
@Controller("fuel-price")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FuelPriceController {
  constructor(private readonly fuelPriceService: FuelPriceService) {}

  /**
   * Trigger a manual fuel-price refresh from fuelpricesqld.com.au.
   *
   * Returns a structured result: on success, the new price and timestamp;
   * on failure (bad token, API error, no valid prices), the reason why
   * the last stored price was retained.
   *
   * Throttled: if the API was called less than 60 seconds ago, this returns
   * a 200 with ok=false and throttled=true rather than hammering the paid API.
   *
   * The cron at 02:00 UTC is NOT affected — it continues to fire independently.
   */
  @Post("refresh")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary: "Manually trigger a fuel-price refresh from fuelpricesqld.com.au.",
    description:
      "Returns { ok, message, pricePerLitre?, fetchedAt? }. " +
      "On failure the last stored price is retained; ok=false with the reason. " +
      "Calls within 60s of the previous fetch return ok=false, throttled=true."
  })
  @ApiResponse({
    status: 200,
    description:
      "{ ok: boolean, message: string, pricePerLitre?: number, fetchedAt?: string, throttled?: boolean }"
  })
  refreshFuelPrice() {
    return this.fuelPriceService.manualRefresh();
  }
}
