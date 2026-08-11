import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesController } from "./schedule-of-rates.controller";
import { ScheduleOfRatesService } from "./schedule-of-rates.service";
import { SorClientRateCardController } from "./sor-client-rate-card.controller";
import { SorClientRateCardService } from "./sor-client-rate-card.service";

/**
 * Schedule of Rates module — master rate-book for live jobs.
 *
 * S1: SorPeriod (H1/H2 year buckets), SorRate (labour/plant/waste/subbie
 *     line items), SorChangeLogEntry (append-only audit trail).
 * S3: SorClientRateCard + SorClientRateEntry (per-client override/add/remove
 *     on top of master; snapshot-override-reset pattern).
 *
 * Permissions: `rates.manage` (existing Rates R0 permission, PR-487).
 *
 * Separate from the tender estimate engine (TenderRateSet / EstimatePlantRate /
 * EstimateWasteRate). Later slices add job-attach, VC/AR pricing,
 * PDF, and approval chain.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ScheduleOfRatesController, SorClientRateCardController],
  providers: [ScheduleOfRatesService, SorClientRateCardService],
  exports: [ScheduleOfRatesService, SorClientRateCardService]
})
export class ScheduleOfRatesModule {}
