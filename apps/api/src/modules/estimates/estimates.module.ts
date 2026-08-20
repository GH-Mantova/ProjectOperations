import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RatesModule } from "../rates/rates.module";
import { EstimatesController } from "./estimates.controller";
import { EstimatesService } from "./estimates.service";
import { FuelPriceController } from "./fuel-price.controller";
import { FuelPriceService } from "./fuel-price.service";

/**
 * Nest module for the estimating surface (§5 Tendering & Estimating).
 *
 * Wires the rate-library and per-tender estimate REST endpoints
 * ({@link EstimatesController}) on top of {@link EstimatesService}.
 * Imports {@link AuditModule} because every estimate write is audited.
 * `EstimatesService` is re-exported so downstream modules (e.g. job
 * conversion) can read estimate state without re-importing the
 * controller.
 *
 * {@link FuelPriceService} is registered here and runs a daily @Cron job
 * (02:00 UTC) to pull Ampol diesel prices from fuelpricesqld.com.au and
 * write them to OperationsSettings (R3 T-2).
 *
 * {@link FuelPriceController} exposes POST /fuel-price/refresh for manual
 * admin-triggered refreshes (guarded by platform.admin).
 */
@Module({
  imports: [AuditModule, RatesModule],
  controllers: [EstimatesController, FuelPriceController],
  providers: [EstimatesService, FuelPriceService],
  exports: [EstimatesService, FuelPriceService]
})
export class EstimatesModule {}
