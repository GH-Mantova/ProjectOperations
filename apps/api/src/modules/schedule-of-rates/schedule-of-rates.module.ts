import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesController } from "./schedule-of-rates.controller";
import { ScheduleOfRatesService } from "./schedule-of-rates.service";

/**
 * Schedule of Rates module (SoR S1) — master rate-book for live jobs.
 *
 * Manages SorPeriod (H1/H2 year buckets), SorRate (labour/plant/waste/subbie
 * line items), and SorChangeLogEntry (append-only audit trail).
 *
 * Permissions: `rates.manage` (existing Rates R0 permission, PR-487).
 *
 * Separate from the tender estimate engine (TenderRateSet / EstimatePlantRate /
 * EstimateWasteRate). Later slices add admin UI, job-attach, VC/AR pricing,
 * PDF, and approval chain.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ScheduleOfRatesController],
  providers: [ScheduleOfRatesService],
  exports: [ScheduleOfRatesService]
})
export class ScheduleOfRatesModule {}
